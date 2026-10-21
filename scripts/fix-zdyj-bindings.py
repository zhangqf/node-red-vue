"""
补齐 ZDJ9 / ZYJ7 的绑定关系。

现状
----
device 表有 4 个机型（ZD6 / ZD9 / ZYJ7 / ZDJ9），combination 表按 deviceType
给每个机型准备了各自的组合方式，config 表里配置名形如「机型【组合方式】」。

但绑定关系不完整：

    ZD6  10 个组合方式，全部已绑
    ZD9   9 个组合方式，全部已绑
    ZDJ9  3 个组合方式，一个都没绑
    ZYJ7  4 个组合方式，只绑了 ZYJ7+SH6双机，且该组合方式下 0 个配置

另有 6 个配置完全没有绑定记录：
    ZDJ9【ZDJ9双机/ZDJ9五机/ZDJ9单机】
    ZYJ7【ZYJ7单机】
    ZYJ7【ZYJ7全主机】
    SH6【ZYJ7+SH6五机】
    SH6【ZYJ7+SH6双机】
    ZYJ7【ZYJ7+SH6双机】
    一动B机【双-单-双】        ← 属 ZD6/ZD9，Excel 动作表里也有它

关键点
------
ZD6 与 ZD9 的配置**名字大量重叠**（34 个名字两边都有），但它们是不同的
两条记录，各自绑到各自的组合方式。区分只能靠 binding_id 里的 deviceId，
不能靠配置名。

因此这里的做法是：以「配置名【】里的组合方式」为准，为每个机型补齐
device -> 组合方式 -> 配置 三层绑定。配置名相同的两条记录，靠它已经绑到的
deviceId 区分归属；分不清的（如 ZYJ7 的 SH6 / ZYJ7 两个配置）按名称前缀
（ZYJ7 / SH6 / ZDJ9）判定。

只补缺失的绑定，不改任何已有绑定，也不改配置内容。
"""
import re
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / "nr" / "data" / "device.db"

# ZYJ7 / ZDJ9 的配置按名称前缀就能分清（这些机型没有同名双份的情况）
PREFIX_OWNER = {
    "ZYJ7": ("ZYJ7", "SH6"),
    "ZDJ9": ("ZDJ9",),
}


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    device_type = dict(
        cur.execute("SELECT id, typeName FROM device").fetchall()
    )
    combos = {
        (dt, name): cid
        for cid, name, dt in cur.execute(
            "SELECT id, name, deviceType FROM combination"
        )
    }

    # 某机型下已有的绑定：deviceId -> {combinationId}
    dev_combo = {}
    for did, cid in cur.execute(
        "SELECT device_id, combination_id FROM device_combination_bindings"
    ):
        dev_combo.setdefault(did, set()).add(cid)

    # 某条配置已绑到的 deviceId（用来判断 ZD6/ZD9 里它属于哪边）
    cfg_devices = {}
    for cid, bid in cur.execute(
        "SELECT config_id, binding_id FROM combination_config_bindings"
    ):
        dev = bid.split("_", 1)[0]
        cfg_devices.setdefault(cid, set()).add(dev)

    # 配置名 -> 组合方式列表
    configs = []
    for cid, cname in cur.execute("SELECT id, name FROM config"):
        m = re.search(r"【([^】]+)】", cname)
        if not m:
            continue
        parts = [p.strip() for p in m.group(1).split("/") if p.strip()]
        configs.append((cid, cname.strip(), parts))

    added_dev = 0
    added_cfg = 0

    for dtype in ("ZD6", "ZD9", "ZYJ7", "ZDJ9"):
        did = next((d for d, dt in device_type.items() if dt == dtype), None)
        if not did:
            print(f"[{dtype}] device 表里没有该机型，跳过")
            continue
        own_combos = {
            name: cid for (dt, name), cid in combos.items() if dt == dtype
        }

        # ---- 1) 机型 -> 组合方式 ----
        for name, cid in own_combos.items():
            if cid not in dev_combo.get(did, set()):
                cur.execute(
                    "INSERT INTO device_combination_bindings "
                    "(device_id, combination_id) VALUES (?, ?)",
                    (did, cid),
                )
                dev_combo.setdefault(did, set()).add(cid)
                added_dev += 1

        # ---- 2) 组合方式 -> 配置 ----
        for cid, cname, parts in configs:
            # 该配置属于哪个机型
            owners = cfg_devices.get(cid, set())
            if did in owners:
                owner = dtype
            elif owners:
                continue                      # 已明确属于别的机型
            else:
                # 未绑定的：靠名称前缀判定（只对 ZYJ7/ZDJ9 有意义）
                if dtype in PREFIX_OWNER:
                    if not cname.startswith(PREFIX_OWNER[dtype]):
                        continue
                else:
                    # ZD6 / ZD9 靠名字分不出来，未绑定的一律不猜
                    continue
            for p in parts:
                combo_id = own_combos.get(p)
                if not combo_id:
                    continue
                bind_id = f"{did}_{combo_id}"
                exists = cur.execute(
                    "SELECT 1 FROM combination_config_bindings "
                    "WHERE binding_id=? AND config_id=?",
                    (bind_id, cid),
                ).fetchone()
                if not exists:
                    cur.execute(
                        "INSERT INTO combination_config_bindings "
                        "(binding_id, config_id) VALUES (?, ?)",
                        (bind_id, cid),
                    )
                    added_cfg += 1

    conn.commit()
    print(f"新增 device_combination_bindings {added_dev} 条")
    print(f"新增 combination_config_bindings {added_cfg} 条")

    print("\n=== 补齐后的状态 ===")
    for dtype in ("ZD6", "ZD9", "ZYJ7", "ZDJ9"):
        did = next((d for d, dt in device_type.items() if dt == dtype), None)
        if not did:
            continue
        own = sorted(n for (dt, n) in combos if dt == dtype)
        print(f"\n[{dtype}] {len(own)} 个组合方式")
        for name in own:
            cid = combos[(dtype, name)]
            bound = cid in dev_combo.get(did, set())
            cfgs = cur.execute(
                "SELECT config_id FROM combination_config_bindings "
                "WHERE binding_id=?",
                (f"{did}_{cid}",),
            ).fetchall()
            names = [
                cur.execute(
                    "SELECT name FROM config WHERE id=?", (x[0],)
                ).fetchone()[0].strip()
                for x in cfgs
            ]
            mark = "✓" if bound and names else "✗"
            print(f"  {mark} {name:22s} 绑定={'有' if bound else '无'} "
                  f"配置{len(names)}: {names}")
    conn.close()


if __name__ == "__main__":
    main()
