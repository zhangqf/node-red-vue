"""
补齐「无外部配线」三个配置的表示继电器与一级传动表示。

背景
----
ZD6 / ZD9 的表示继电器分工是固定的：

    DWBS（定位表示）      -> C1, C2
    FWBS（反位表示）      -> C3, C4
    YJCDDWBS（一级传动定位）-> C5~C8 之一
    YJCDFWBS（一级传动反位）-> C5~C8 之一

「无外部配线」的三个配置（ZD6-E / ZD6-J / ZD6-D）原来只有 C1~C4，一级传动
表示是空的，所以工作界面的表示测试只剩下 C1 C2 C3 C4，看不到后面那几级。

现场确认的取值：

    表示继电器          补到 C1~C8
    13 闭合（1-3 闭合） 一级传动定位 = C7，一级传动反位 = C8
    24 闭合（2-4 闭合） 一级传动定位 = C8，一级传动反位 = C7

与参照配置「一动B机【双-单-双】」一致（B 机式接线，端子走 D13/D14）。

作用范围
--------
配置名以 ZD6-E【无外部配线】/ ZD6-J【无外部配线】/ ZD6-D【无外部配线】 开头
的配置，含用户另存出来的「(副本)」。

只动表示继电器清单和 YJCDDWBS / YJCDFWBS 两项。DWBS / FWBS（定位、反位
表示）、DC / FC（定操、反操）以及其余字段一律保持原样。

用法
----
    python3 scripts/sync-zd6-internal-wiring-indication.py [--dry-run]

改 device.db 前必须先停掉 Node-RED：它持有该文件的句柄，运行中覆盖会丢数据。
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / "nr" / "data" / "device.db"

TARGET_PREFIXES = (
    "ZD6-E【无外部配线】",
    "ZD6-J【无外部配线】",
    "ZD6-D【无外部配线】",
)

# 表示继电器补到 8 个
INDICATION_RELAYS = [f"C{i}" for i in range(1, 9)]

# 一级传动表示：13 闭合 / 24 闭合 各用哪两个
LEVEL1_13 = {"YJCDDWBS": ["C7"], "YJCDFWBS": ["C8"]}
LEVEL1_24 = {"YJCDDWBS": ["C8"], "YJCDFWBS": ["C7"]}

INNER_RE = re.compile(r"【([^】]+)】")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="只打印改动，不写库")
    args = parser.parse_args()

    if not DB.exists():
        raise SystemExit(f"找不到数据库 {DB}")

    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # ---------- 目标配置 ----------
    targets: list[tuple[str, str]] = []
    for cid, cname in cur.execute("SELECT id, name FROM config"):
        if cname.startswith(TARGET_PREFIXES):
            targets.append((cid, cname))

    if not targets:
        raise SystemExit("没有找到「无外部配线」的配置")

    print(f"目标配置 {len(targets)} 个：")
    for cid, cname in targets:
        print(f"  {cid}  {cname}")

    # ---------- 预演改动 ----------
    relay_add = 0
    field_change = 0
    for cid, _ in targets:
        have = {
            r[0]
            for r in cur.execute(
                "SELECT relay_name FROM config_indication_relays WHERE config_id = ?",
                (cid,),
            )
        }
        relay_add += sum(1 for n in INDICATION_RELAYS if n not in have)

        for col, want in (
            ("contact_13_closed", LEVEL1_13),
            ("contact_24_closed", LEVEL1_24),
        ):
            row = cur.execute(f"SELECT {col} FROM config WHERE id = ?", (cid,)).fetchone()
            data = json.loads(row[0]) if row and row[0] else {}
            if any((data.get(k) or []) != v for k, v in want.items()):
                field_change += 1
                break

    print(f"\n  表示继电器待补 {relay_add} 条")
    print(f"  一级传动表示待改 {field_change} 个配置")

    if args.dry_run:
        print("\n[dry-run] 未写库")
        conn.close()
        return

    backup = DB.with_suffix(".db.bak")
    shutil.copy2(DB, backup)
    print(f"\n已备份 {backup.name}")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        for cid, _ in targets:
            have = {
                r[0]
                for r in cur.execute(
                    "SELECT relay_name FROM config_indication_relays WHERE config_id = ?",
                    (cid,),
                )
            }
            for order, name in enumerate(INDICATION_RELAYS, start=1):
                if name in have:
                    continue
                cur.execute(
                    """
                    INSERT OR IGNORE INTO config_indication_relays
                        (id, config_id, relay_name, default_status, sort_order)
                    VALUES (?, ?, ?, 0, ?)
                    """,
                    (f"{cid}_{name}", cid, name, order),
                )

            for col, want in (
                ("contact_13_closed", LEVEL1_13),
                ("contact_24_closed", LEVEL1_24),
            ):
                row = cur.execute(f"SELECT {col} FROM config WHERE id = ?", (cid,)).fetchone()
                data = json.loads(row[0]) if row and row[0] else {}
                if all((data.get(k) or []) == v for k, v in want.items()):
                    continue
                for k, v in want.items():
                    data[k] = list(v)
                cur.execute(
                    f"UPDATE config SET {col} = ?, updated_at = ? WHERE id = ?",
                    (json.dumps(data, ensure_ascii=False), now, cid),
                )

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    # ---------- 校验 ----------
    print("\n校验：")
    ok = True

    for cid, cname in targets:
        have = [
            r[0]
            for r in cur.execute(
                "SELECT relay_name FROM config_indication_relays WHERE config_id = ?"
                " ORDER BY sort_order",
                (cid,),
            )
        ]
        missing = [n for n in INDICATION_RELAYS if n not in have]
        if missing:
            ok = False
            print(f"  ✗ {cname}: 缺表示继电器 {missing}")
            continue

        a13, a24 = cur.execute(
            "SELECT contact_13_closed, contact_24_closed FROM config WHERE id = ?",
            (cid,),
        ).fetchone()
        d13 = json.loads(a13 or "{}")
        d24 = json.loads(a24 or "{}")
        bad = []
        for k, v in LEVEL1_13.items():
            if (d13.get(k) or []) != v:
                bad.append(f"13闭合.{k}={d13.get(k)}")
        for k, v in LEVEL1_24.items():
            if (d24.get(k) or []) != v:
                bad.append(f"24闭合.{k}={d24.get(k)}")
        if bad:
            ok = False
            print(f"  ✗ {cname}: {bad}")
        else:
            print(
                f"  ✓ {cname}: 表示继电器 {len(have)} 个(C1~C8)，"
                f"13闭合 一级={d13.get('YJCDDWBS')}/反一级={d13.get('YJCDFWBS')}，"
                f"24闭合 一级={d24.get('YJCDDWBS')}/反一级={d24.get('YJCDFWBS')}"
            )

    conn.close()
    if not ok:
        raise SystemExit("校验未通过")


if __name__ == "__main__":
    main()
