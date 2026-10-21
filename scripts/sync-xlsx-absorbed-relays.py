"""
按继电器动作表（ZD6转辙机测试仪继电器动作表.xlsx）同步 ZD6/ZD9 配置的吸合继电器。

映射依据
--------
Excel 表的分组由 C 列（组合方式）合并区划出，行11 独立成组。组内配置顺序与
数据库配置一致（按「机器数 + 机型字母」排：一动A < 一动B < 一动E < 一动J <
二动..），每组用「吸合继电器序列完全吻合」校验后唯一确定。

9 组里 5 组现状已与表格一致，需要改的 4 组：

  单动单机     ZD6-D【单动单机】        KA1 KA2 KA4 KA5 KA6  ->  KA4
  单动双机     单动B机【单动双机】      9 个吸合            ->  5 个吸合
  双-单-单     一动B机【双-单-单】      5 个吸合            ->  9 个吸合
  双-单-单-单   一动B机【双-单-单-单】    5 个吸合            ->  9 个吸合

Excel 的吸合继电器用简写（KA1 2 4 5 6 表示 KA1 KA2 KA4 KA5 KA6），比对与
写入前都要展开。

ZD6 与 ZD9 的配置内容完全相同（只有 id 不同），两侧都改。

不动：config_relays 的行集合（继电器型号清单）、表示继电器、定操/反操触点。
"""
import re
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / "nr" / "data" / "device.db"

# (配置名前缀, 期望吸合继电器)
CHANGES = [
    ("ZD6-D【单动单机】", ["KA4"]),
    ("单动B机【单动双机】", ["KA1", "KA2", "KA4", "KA5", "KA6"]),
    ("一动B机【双-单-单】", ["KA1", "KA2", "KA4", "KA5", "KA6", "KA7", "KA8", "KA9", "KA10"]),
    ("一动B机【双-单-单-单】", ["KA1", "KA2", "KA4", "KA5", "KA6", "KA7", "KA8", "KA9", "KA10"]),
]


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    for name, want in CHANGES:
        rows = cur.execute(
            "SELECT id FROM config WHERE name = ?", (name,)
        ).fetchall()
        if not rows:
            print(f"[跳过] 找不到配置 {name}")
            continue
        for (cid,) in rows:
            relays = cur.execute(
                "SELECT relay_name, default_status FROM config_relays "
                "WHERE config_id = ? ORDER BY sort_order",
                (cid,),
            ).fetchall()
            if not relays:
                print(f"[跳过] {name} 没有动作继电器")
                continue
            want_set = set(want)
            unknown = want_set - {r[0] for r in relays}
            if unknown:
                raise SystemExit(f"{name} 缺少继电器 {sorted(unknown)}")
            before = sorted(r[0] for r in relays if r[1] == 1)
            changed = 0
            for relay, _ in relays:
                new_status = 1 if relay in want_set else 0
                cur.execute(
                    "UPDATE config_relays SET default_status = ? "
                    "WHERE config_id = ? AND relay_name = ?",
                    (new_status, cid, relay),
                )
                changed += 1
            after = sorted(
                r[0]
                for r in cur.execute(
                    "SELECT relay_name, default_status FROM config_relays "
                    "WHERE config_id = ? AND default_status = 1 ORDER BY sort_order",
                    (cid,),
                )
            )
            print(f"{name} [{cid[:8]}]")
            print(f"    改前: {before}")
            print(f"    改后: {after}")
    conn.commit()

    print("\n=== 校验 ===")
    for name, want in CHANGES:
        for (cid,) in cur.execute(
            "SELECT id FROM config WHERE name = ?", (name,)
        ).fetchall():
            got = sorted(
                r[0]
                for r in cur.execute(
                    "SELECT relay_name FROM config_relays WHERE config_id = ? "
                    "AND default_status = 1",
                    (cid,),
                )
            )
            ok = got == sorted(want)
            print(f"  {'✓' if ok else '✗'} {name} [{cid[:8]}]: {got}")
    conn.close()


if __name__ == "__main__":
    main()
