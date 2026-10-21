"""
把 ZD6 / ZD9 的测试机型配置对齐到「一动B机【双-单-双】」。

两件事
------
1. 动作继电器补齐到 KA32

   ZD6 / ZD9 的配置原来只有 KA1~KA25，现场要求统一补到 32 级。新增的
   KA26~KA32 默认状态取 0（与已有的两个 32 级配置一致：b466c2b8、819b3553）。

2. 1-3 闭合 / 2-4 闭合 里的定操(DC)、反操(FC) 统一成参照配置的值

       13 闭合(定操)：DC = KA11 KA23 KA24 KA31
                        FC = KA13 KA23 KA24 KA31
       24 闭合(反操)：DC = KA13 KA23 KA24 KA31
                        FC = KA11 KA23 KA24 KA31

   只改 DC 与 FC 两项。DWBS / FWBS（表示触点归属）、YJCDDWBS / YJCDFWBS
   （传动表示）、EJCDDWBS / EJCDFWBS、DCB / DCC / FCB / FCC 一律保持原样。
   表示继电器清单也不动。

   注意 DC / FC 里引用了 KA31，所以补继电器和改触点必须一起做——KA31 在
   补齐前并不存在于绝大多数配置里。

参照配置取自数据库里现存的「一动B机【双-单-双】」，不写死常量，避免两处
不一致。

作用范围
--------
配置名【】里是 ZD6 或 ZD9 组合方式的所有配置。按名字判定而不是按绑定关系，
是为了连尚未绑定的配置也一起覆盖（绑定关系只能推出现有的 74 个，名字判定
是 75 个）。ZYJ7 / ZDJ9 的组合方式名与 ZD6 / ZD9 不重名，不会被误伤。

用法
----
    python3 scripts/sync-zd6-zd9-ka32-contacts.py [--dry-run]

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

REFERENCE_NAME = "一动B机【双-单-双】"
TARGET_TYPES = ("ZD6", "ZD9")

# 动作继电器补到 32 级
MAX_ACTION_RELAY = 32

INNER_RE = re.compile(r"【([^】]+)】")


def inner_names(config_name: str) -> list[str]:
    """取配置名【】里的组合方式名，支持「ZDJ9双机/ZDJ9五机」这种多值写法。"""
    m = INNER_RE.search(config_name or "")
    if not m:
        return []
    return [part.strip() for part in m.group(1).split("/") if part.strip()]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只打印将要做的改动，不写库",
    )
    args = parser.parse_args()

    if not DB.exists():
        raise SystemExit(f"找不到数据库 {DB}")

    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # ---------- 参照配置 ----------
    ref_row = cur.execute(
        "SELECT id, contact_13_closed, contact_24_closed FROM config WHERE name = ?",
        (REFERENCE_NAME,),
    ).fetchone()
    if not ref_row:
        raise SystemExit(f"找不到参照配置 {REFERENCE_NAME}")
    ref_id, ref_13, ref_24 = ref_row
    ref13 = json.loads(ref_13) if ref_13 else {}
    ref24 = json.loads(ref_24) if ref_24 else {}

    print(f"参照配置 {REFERENCE_NAME} ({ref_id})")
    for label, ref in (("13闭合", ref13), ("24闭合", ref24)):
        print(f"  {label} DC={ref.get('DC')}  FC={ref.get('FC')}")

    # ---------- 目标配置 ----------
    combo_names: set[str] = set()
    for dtype in TARGET_TYPES:
        for (cname,) in cur.execute(
            "SELECT name FROM combination WHERE deviceType = ?", (dtype,)
        ):
            combo_names.add(cname)

    targets: list[tuple[str, str]] = []
    for cid, cname in cur.execute("SELECT id, name FROM config"):
        if set(inner_names(cname)) & combo_names:
            targets.append((cid, cname))

    print(f"\n目标配置 {len(targets)} 个（ZD6/ZD9 组合方式下的全部配置）")

    # ---------- 统计改动 ----------
    relay_added = 0
    contacts_changed = 0
    for cid, _ in targets:
        have = {
            r[0]
            for r in cur.execute(
                "SELECT relay_name FROM config_relays WHERE config_id = ?", (cid,)
            )
        }
        relay_added += sum(
            1 for n in range(1, MAX_ACTION_RELAY + 1) if f"KA{n}" not in have
        )

        for col, ref in (
            ("contact_13_closed", ref13),
            ("contact_24_closed", ref24),
        ):
            row = cur.execute(f"SELECT {col} FROM config WHERE id = ?", (cid,)).fetchone()
            data = json.loads(row[0]) if row and row[0] else {}
            if any(
                (data.get(key) or []) != (ref.get(key) or []) for key in ("DC", "FC")
            ):
                contacts_changed += 1
                break

    print(f"  动作继电器待补 {relay_added} 条")
    print(f"  触点待改 {contacts_changed} 个配置")

    if args.dry_run:
        print("\n[dry-run] 未写库")
        conn.close()
        return

    # ---------- 备份 ----------
    backup = DB.with_suffix(".db.bak")
    shutil.copy2(DB, backup)
    print(f"\n已备份 {backup.name}")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    changed_ids: set[str] = set()

    try:
        for cid, cname in targets:
            have = {
                r[0]
                for r in cur.execute(
                    "SELECT relay_name FROM config_relays WHERE config_id = ?", (cid,)
                )
            }
            for n in range(1, MAX_ACTION_RELAY + 1):
                name = f"KA{n}"
                if name in have:
                    continue
                cur.execute(
                    """
                    INSERT OR IGNORE INTO config_relays
                        (id, config_id, relay_name, default_status, sort_order)
                    VALUES (?, ?, ?, 0, ?)
                    """,
                    (f"{cid}_{name}", cid, name, n),
                )
                changed_ids.add(cid)

            for col, ref in (
                ("contact_13_closed", ref13),
                ("contact_24_closed", ref24),
            ):
                row = cur.execute(
                    f"SELECT {col} FROM config WHERE id = ?", (cid,)
                ).fetchone()
                data = json.loads(row[0]) if row and row[0] else {}
                dirty = False
                for key in ("DC", "FC"):
                    want = ref.get(key) or []
                    if (data.get(key) or []) != want:
                        data[key] = list(want)
                        dirty = True
                if dirty:
                    cur.execute(
                        f"UPDATE config SET {col} = ?, updated_at = ? WHERE id = ?",
                        (json.dumps(data, ensure_ascii=False), now, cid),
                    )
                    changed_ids.add(cid)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    # ---------- 校验 ----------
    print(f"\n已改写 {len(changed_ids)} 个配置\n")

    ok = True

    # 继电器数量
    bad = []
    for cid, cname in targets:
        have = {
            r[0]
            for r in cur.execute(
                "SELECT relay_name FROM config_relays WHERE config_id = ?", (cid,)
            )
        }
        missing = [f"KA{n}" for n in range(1, MAX_ACTION_RELAY + 1) if f"KA{n}" not in have]
        if missing:
            bad.append((cid, cname, missing))
    if bad:
        ok = False
        print(f"  动作继电器: ✗ {len(bad)} 个配置不完整")
        for cid, cname, missing in bad[:5]:
            print(f"      {cid[:8]} {cname} 缺 {missing}")
    else:
        print(f"  动作继电器 KA1~KA{MAX_ACTION_RELAY}: ✓ 全部齐备（{len(targets)} 个配置）")

    # 触点
    for label, col, ref in (
        ("13闭合", "contact_13_closed", ref13),
        ("24闭合", "contact_24_closed", ref24),
    ):
        for key in ("DC", "FC"):
            mismatch = []
            for cid, cname in targets:
                row = cur.execute(
                    f"SELECT {col} FROM config WHERE id = ?", (cid,)
                ).fetchone()
                data = json.loads(row[0]) if row and row[0] else {}
                if (data.get(key) or []) != (ref.get(key) or []):
                    mismatch.append((cid, cname))
            if mismatch:
                ok = False
                print(f"  {label} {key:3s}: ✗ {len(mismatch)} 个不一致")
                for cid, cname in mismatch[:5]:
                    print(f"      {cid[:8]} {cname}")
            else:
                print(f"  {label} {key:3s}: ✓ {ref.get(key)}")

    # 其余字段确认没被动
    print()
    for label, col in (
        ("13闭合", "contact_13_closed"),
        ("24闭合", "contact_24_closed"),
    ):
        for key in ("DWBS", "FWBS", "YJCDDWBS", "YJCDFWBS"):
            vals = set()
            for cid, _ in targets:
                row = cur.execute(
                    f"SELECT {col} FROM config WHERE id = ?", (cid,)
                ).fetchone()
                data = json.loads(row[0]) if row and row[0] else {}
                vals.add(tuple(data.get(key) or []))
            print(f"  {label} {key:11s}: {len(vals)} 种取值 {sorted(vals)}")

    conn.close()
    if not ok:
        raise SystemExit("校验未通过")


if __name__ == "__main__":
    main()
