"""
把 ZD6 / ZD9 全部配置的「定操/反操」触点定义统一成「一动B机【双-单-双】」。

背景
----
定操/反操回路里各组触点归属哪个闭合方式，存放在 config 表的
contact_13_closed / contact_24_closed 两个 JSON 字段里。现场要求 ZD6 与
ZD9 的所有配置都按「一动B机【双-单-双】」这一套走：

    13 闭合(定操)：DC = KA11 KA23 KA24 KA31
                     FC = KA13 KA23 KA24 KA31
    24 闭合(反操)：DC = KA13 KA23 KA24 KA31
                     FC = KA11 KA23 KA24 KA31

只改 DC 与 FC 两项。DWBS / FWBS（表示触点归属）现状已与参照一致，不动；
YJCDDWBS / YJCDFWBS（传动表示）按要求先不动；EJCDDWBS / EJCDFWBS 本来
就是空的。动作继电器清单与吸合状态、表示继电器清单也都不动。

参照配置取自数据库里现存的「一动B机【双-单-双】」，不写死常量，避免两处
不一致。
"""
import json
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / "nr" / "data" / "device.db"

REFERENCE_NAME = "一动B机【双-单-双】"
TARGET_TYPES = ("ZD6", "ZD9")


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # ---------- 参照配置 ----------
    row = cur.execute(
        "SELECT id, contact_13_closed, contact_24_closed FROM config WHERE name = ?",
        (REFERENCE_NAME,),
    ).fetchone()
    if not row:
        raise SystemExit(f"找不到参照配置 {REFERENCE_NAME}")
    ref_id, ref_13, ref_24 = row
    ref13 = json.loads(ref_13) if ref_13 else {}
    ref24 = json.loads(ref_24) if ref_24 else {}

    # ---------- 目标配置：ZD6 / ZD9，按绑定关系取 ----------
    targets: list[str] = []
    for cid, dtype in cur.execute(
        """
        SELECT ccb.config_id, cb.deviceType
        FROM combination_config_bindings ccb
        JOIN combination cb
          ON cb.id = substr(ccb.binding_id, instr(ccb.binding_id, '_') + 1)
        WHERE cb.deviceType IN ('ZD6', 'ZD9')
        """
    ):
        if cid not in targets:
            targets.append(cid)

    print(f"参照配置 : {REFERENCE_NAME}")
    print(f"           13闭合 DC={ref13.get('DC')} FC={ref13.get('FC')}")
    print(f"           24闭合 DC={ref24.get('DC')} FC={ref24.get('FC')}")
    print(f"目标配置 : {len(targets)} 个 (ZD6 + ZD9)\n")

    # ---------- 改写 ----------
    changed = 0
    for cid in targets:
        r = cur.execute(
            "SELECT name, contact_13_closed, contact_24_closed FROM config WHERE id = ?",
            (cid,),
        ).fetchone()
        name, cur_13, cur_24 = r
        d13 = json.loads(cur_13) if cur_13 else {}
        d24 = json.loads(cur_24) if cur_24 else {}

        # 只动 DC 与 FC，其余字段原样保留
        new13 = dict(d13)
        new13["DC"] = list(ref13.get("DC") or [])
        new13["FC"] = list(ref13.get("FC") or [])
        new24 = dict(d24)
        new24["DC"] = list(ref24.get("DC") or [])
        new24["FC"] = list(ref24.get("FC") or [])

        if new13 == d13 and new24 == d24:
            continue

        cur.execute(
            "UPDATE config SET contact_13_closed = ?, contact_24_closed = ? WHERE id = ?",
            (
                json.dumps(new13, ensure_ascii=False),
                json.dumps(new24, ensure_ascii=False),
                cid,
            ),
        )
        changed += 1

    conn.commit()

    # ---------- 校验 ----------
    print(f"已改写 {changed} 个配置\n")
    ok = True
    for field, col in (("13闭合", "contact_13_closed"), ("24闭合", "contact_24_closed")):
        ref = ref13 if field == "13闭合" else ref24
        for key in ("DC", "FC"):
            bad = 0
            for cid in targets:
                r = cur.execute(
                    f"SELECT {col} FROM config WHERE id = ?", (cid,)
                ).fetchone()
                d = json.loads(r[0]) if r and r[0] else {}
                if (d.get(key) or []) != (ref.get(key) or []):
                    bad += 1
            status = "✓" if bad == 0 else f"✗ {bad} 个不一致"
            if bad:
                ok = False
            print(f"  {field} {key:3s}: {status}  ({ref.get(key)})")

    # 确认其余字段没被动
    print()
    for field, col in (("13闭合", "contact_13_closed"), ("24闭合", "contact_24_closed")):
        for key in ("DWBS", "FWBS", "YJCDDWBS", "YJCDFWBS", "EJCDDWBS", "EJCDFWBS"):
            vals = set()
            for cid in targets:
                r = cur.execute(f"SELECT {col} FROM config WHERE id = ?", (cid,)).fetchone()
                d = json.loads(r[0]) if r and r[0] else {}
                vals.add(tuple(d.get(key) or []))
            print(f"  {field} {key:11s}: {len(vals)} 种取值 {list(vals)[:2]}")

    conn.close()
    if not ok:
        raise SystemExit("校验未通过")


if __name__ == "__main__":
    main()
