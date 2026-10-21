"""
合并 nr 分支的 device.db：把远程的新数据与本地的数据改动合到一起。

背景
----
远程 github/nr 上有个合并提交 76fa0d3，合并 device.db 时直接取了对方那版
（5464177），把本地 656727b 引入的数据库改动整个覆盖掉了——combination_wiring
表、3 个「无外部配线」配置、「无外部配线」组合方式都不见了。

device.db 是二进制文件，git 无法合并，只能在数据层做。本脚本的策略是：
以**远程版本**为基底（保留他们的现场记录与新增继电器），再重放本地的数据改动：

  1. combination_wiring 表（组合方式 -> 配线类型）
  2. 「无外部配线」组合方式 + ZD6-E / ZD6-J / ZD6-D 三个配置
  3. ZD6 / ZD9 / ZYJ7 / ZDJ9 的绑定关系
  4. 继电器动作表要求的吸合继电器

第 1~3 步由 seed-zd6-internal-wiring.py 与 fix-zdyj-bindings.py 承担，
本脚本只负责准备基底并串联执行，最后逐表比对确认没有丢东西。
"""
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "nr" / "data" / "device.db"
REMOTE_DB = Path(sys.argv[1]) if len(sys.argv) > 1 else None

# 远程合并提交里 device.db 丢失的本地内容（用 656727b 的版本恢复）
ANCESTOR_DB = Path(
    "/private/var/folders/3c/s1qj14k95fq5t50nxkn739fw0000gn/T/opencode/git_device.db"
)


def table_counts(conn, tables):
    out = {}
    for t in tables:
        try:
            out[t] = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        except sqlite3.Error:
            out[t] = None
    return out


def main() -> None:
    if not REMOTE_DB or not REMOTE_DB.exists():
        raise SystemExit("用法: merge-device-db.py <远程 device.db 路径>")
    if not ANCESTOR_DB.exists():
        raise SystemExit(f"找不到祖先库 {ANCESTOR_DB}")

    tables = [
        "config",
        "config_relays",
        "config_indication_relays",
        "combination",
        "combination_wiring",
        "combination_config_bindings",
        "device_combination_bindings",
        "operation_records",
    ]

    print("=== 合并前 ===")
    before = {}
    for label, path in (("祖先", ANCESTOR_DB), ("远程", REMOTE_DB), ("本地", DB)):
        conn = sqlite3.connect(path)
        before[label] = table_counts(conn, tables)
        conn.close()
        print(f"  {label}: {before[label]}")

    # 基底 = 远程版本（保留他们的现场记录与新增继电器）
    print("\n=== 以远程版本为基底 ===")
    shutil.copy(REMOTE_DB, DB)
    conn = sqlite3.connect(DB)
    print(f"  基底行数: {table_counts(conn, tables)}")
    conn.close()

    # 重放本地的数据改动
    for script in (
        "seed-zd6-internal-wiring.py",
        "fix-zdyj-bindings.py",
        "sync-xlsx-absorbed-relays.py",
    ):
        path = ROOT / "scripts" / script
        if not path.exists():
            print(f"  [跳过] {script} 不存在")
            continue
        print(f"\n--- 执行 {script} ---")
        result = subprocess.run(
            [sys.executable, str(path)], cwd=ROOT, capture_output=True, text=True
        )
        sys.stdout.write(result.stdout)
        if result.returncode != 0:
            sys.stderr.write(result.stderr)
            raise SystemExit(f"{script} 执行失败")

    # 校验
    conn = sqlite3.connect(DB)
    after = table_counts(conn, tables)
    print("\n=== 合并后 ===")
    for label, counts in before.items():
        print(f"  {label}: {counts}")
    print(f"  合并: {after}")

    print("\n=== 逐表核对(合并后 vs 远程/本地, 应只增不减) ===")
    ok = True
    for t in tables:
        rem = before["远程"][t]
        loc = before["本地"][t]
        now = after[t]
        base = max(x for x in (rem, loc) if x is not None) if (rem or loc) else 0
        good = (now is not None) and (now >= base)
        ok = ok and good
        print(f"  {'✓' if good else '✗'} {t:32s} 远程={rem} 本地={loc} -> 合并后={now}")

    # 现场记录必须一条不少
    remote_recs = {
        r[0]
        for r in sqlite3.connect(REMOTE_DB).execute("SELECT id FROM operation_records")
    }
    now_recs = {
        r[0] for r in conn.execute("SELECT id FROM operation_records")
    }
    lost = remote_recs - now_recs
    print(f"\n  远程现场记录 {len(remote_recs)} 条, 合并后丢失 {len(lost)} 条")
    if lost:
        ok = False
        print(f"    丢失: {sorted(lost)[:20]}")

    conn.close()
    if not ok:
        raise SystemExit("合并校验未通过")
    print("\n合并校验通过")


if __name__ == "__main__":
    main()
