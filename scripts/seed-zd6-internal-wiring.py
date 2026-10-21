"""
生成 ZD6「无外部配线」的三个新配置，并写入 device.db。

背景
----
ZDX 转辙机测试仪的继电器动作表把配置分成两个「选型」：
  - 无外部配线：单机使用，机型 ZD6-E / ZD6-J / ZD6-D
  - 有外部配线：多机牵引，先选组合方式再选机型

数据库里「无外部配线」这一层此前没有，组合方式表里也没有对应记录。
本脚本补上：

  1. combination_wiring 表（组合方式 -> 配线类型），并把现有 ZD6 的
     9 个组合方式标为「有外部配线」，新增「无外部配线」组合方式
  2. ZD6-E / ZD6-J / ZD6-D 三个配置，含动作继电器与表示继电器
  3. 上述配置与「无外部配线」组合方式的绑定关系
  4. 顺带清掉 4 条配置名末尾的多余空格

动作继电器（吸合）取自继电器动作表：
  ZD6-E / ZD6-J : KA1 KA2 KA4 KA5 KA6 KA7 KA8 KA9 KA10
  ZD6-D         : KA4
表示继电器与定操/反操触点沿用现有 ZD6 配置的通用形态：
  13 闭合：定位表示 C1 C2，反位表示 C3 C4
  24 闭合：定位表示 C3 C4，反位表示 C1 C2
  DC 触点：KA11 KA14 KA16 KA18 KA23 KA24
  FC 触点：KA13 KA15 KA17 KA19 KA23 KA24

只新增，不改动现有配置的数据。
"""
import sqlite3
import uuid
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / "nr" / "data" / "device.db"

DEVICE_ZD6 = "f0795f36-6476-4d19-a3cf-adf507768538"   # device 表里的「ZD6 转辙机」

WIRING_EXTERNAL = "有外部配线"
WIRING_INTERNAL = "无外部配线"

# 组合方式名 -> 配线类型
EXTERNAL_COMBINATIONS = [
    "双动双机",
    "单动单机",
    "单动双机",
    "单-单-单-单",
    "单-单-双",
    "双-单-单",
    "双-单-双",
    "双-单-单-单",
    "双-单-双-单",
]

# 新配置：(配置名, 吸合的动作继电器, 表示继电器)
NEW_CONFIGS = [
    ("ZD6-E【无外部配线】", ["KA1", "KA2", "KA4", "KA5", "KA6", "KA7", "KA8", "KA9", "KA10"], ["C1", "C2", "C3", "C4"]),
    ("ZD6-J【无外部配线】", ["KA1", "KA2", "KA4", "KA5", "KA6", "KA7", "KA8", "KA9", "KA10"], ["C1", "C2", "C3", "C4"]),
    ("ZD6-D【无外部配线】", ["KA4"], ["C1", "C2", "C3", "C4"]),
]

# 动作继电器全量（KA1~KA25，与现有 ZD6 配置一致）
ALL_ACTION_RELAYS = [f"KA{i}" for i in range(1, 26)]

# 定操/反操触点（沿用现有 ZD6 配置的通用形态）
DC_CONTACTS = ["KA11", "KA14", "KA16", "KA18", "KA23", "KA24"]
FC_CONTACTS = ["KA13", "KA15", "KA17", "KA19", "KA23", "KA24"]


def new_id() -> str:
    return str(uuid.uuid4())


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # ---------- 1. combination_wiring 表 ----------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS combination_wiring (
            combination_id TEXT PRIMARY KEY REFERENCES combination(id) ON DELETE CASCADE,
            wiring_type    TEXT NOT NULL
        )
    """)

    # 现有的 ZD6 组合方式一律标为「有外部配线」
    rows = cur.execute(
        "SELECT id, name FROM combination WHERE deviceType = 'ZD6'"
    ).fetchall()
    combo_ids = {name: cid for cid, name in rows}
    missing = [n for n in EXTERNAL_COMBINATIONS if n not in combo_ids]
    if missing:
        raise SystemExit(f"找不到这些组合方式：{missing}")

    for name in EXTERNAL_COMBINATIONS:
        cur.execute(
            "INSERT OR REPLACE INTO combination_wiring (combination_id, wiring_type) "
            "VALUES (?, ?)",
            (combo_ids[name], WIRING_EXTERNAL),
        )

    # ---------- 2. 「无外部配线」组合方式 ----------
    cur.execute(
        "SELECT id FROM combination WHERE deviceType = 'ZD6' AND name = ?",
        (WIRING_INTERNAL,),
    )
    row = cur.fetchone()
    if row:
        internal_combo_id = row[0]
    else:
        internal_combo_id = new_id()
        cur.execute(
            "INSERT INTO combination (id, name, deviceType, description) "
            "VALUES (?, ?, 'ZD6', ?)",
            (internal_combo_id, WIRING_INTERNAL, "单机使用，无外部配线"),
        )
    cur.execute(
        "INSERT OR REPLACE INTO combination_wiring (combination_id, wiring_type) "
        "VALUES (?, ?)",
        (internal_combo_id, WIRING_INTERNAL),
    )

    # ---------- 3. 三个新配置 ----------
    config_ids = []
    for name, absorbed, indication in NEW_CONFIGS:
        cur.execute("SELECT id FROM config WHERE name = ?", (name,))
        row = cur.fetchone()
        if row:
            config_id = row[0]
        else:
            config_id = new_id()
            cur.execute(
                "INSERT INTO config (id, name, description) VALUES (?, ?, ?)",
                (config_id, name, name.replace("【", " ").replace("】", "")),
            )
            # 动作继电器：全量列出，吸合的置 1
            for order, relay in enumerate(ALL_ACTION_RELAYS, start=1):
                cur.execute(
                    "INSERT OR REPLACE INTO config_relays "
                    "(id, config_id, relay_name, default_status, sort_order) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (
                        f"{config_id}_{relay}",
                        config_id,
                        relay,
                        1 if relay in absorbed else 0,
                        order,
                    ),
                )
            # 表示继电器
            for order, relay in enumerate(indication, start=1):
                cur.execute(
                    "INSERT OR REPLACE INTO config_indication_relays "
                    "(id, config_id, relay_name, default_status, sort_order) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (f"{config_id}_{relay}", config_id, relay, 0, order),
                )
            # 定操/反操触点
            cur.execute(
                "UPDATE config SET contact_13_closed = ?, contact_24_closed = ? "
                "WHERE id = ?",
                (
                    '{"DC": ["KA11","KA14","KA16","KA18","KA23","KA24"], '
                    '"FC": ["KA13","KA15","KA17","KA19","KA23","KA24"], '
                    '"DWBS": ["C1","C2"], "FWBS": ["C3","C4"], '
                    '"YJCDDWBS": [], "YJCDFWBS": [], '
                    '"EJCDDWBS": [], "EJCDFWBS": []}',
                    '{"DC": ["KA13","KA15","KA17","KA19","KA23","KA24"], '
                    '"FC": ["KA11","KA14","KA16","KA18","KA23","KA24"], '
                    '"DWBS": ["C3","C4"], "FWBS": ["C1","C2"], '
                    '"YJCDDWBS": [], "YJCDFWBS": [], '
                    '"EJCDDWBS": [], "EJCDFWBS": []}',
                    config_id,
                ),
            )
        config_ids.append((config_id, name))

    # ---------- 4. 绑定关系 ----------
    for config_id, name in config_ids:
        bind_id = f"{DEVICE_ZD6}_{internal_combo_id}"
        cur.execute(
            "INSERT OR REPLACE INTO combination_config_bindings "
            "(binding_id, config_id) VALUES (?, ?)",
            (bind_id, config_id),
        )
    cur.execute(
        "INSERT OR REPLACE INTO device_combination_bindings "
        "(device_id, combination_id) VALUES (?, ?)",
        (DEVICE_ZD6, internal_combo_id),
    )

    # ---------- 5. 清掉配置名末尾的多余空格 ----------
    fixed = 0
    for cid, name in cur.execute(
        "SELECT id, name FROM config WHERE name != TRIM(name)"
    ).fetchall():
        cur.execute("UPDATE config SET name = ? WHERE id = ?", (name.strip(), cid))
        fixed += 1

    conn.commit()

    # ---------- 汇总 ----------
    print("已写入 device.db\n")
    print("combination_wiring：")
    for cid, wt in cur.execute(
        "SELECT c.name, w.wiring_type FROM combination_wiring w "
        "JOIN combination c ON c.id = w.combination_id ORDER BY w.wiring_type, c.name"
    ):
        print(f"    {wt:8s} {cid}")
    print("\n新配置：")
    for config_id, name in config_ids:
        on = [
            r[0]
            for r in cur.execute(
                "SELECT relay_name FROM config_relays WHERE config_id = ? "
                "AND default_status = 1 ORDER BY sort_order",
                (config_id,),
            )
        ]
        ind = [
            r[0]
            for r in cur.execute(
                "SELECT relay_name FROM config_indication_relays WHERE config_id = ? "
                "ORDER BY sort_order",
                (config_id,),
            )
        ]
        print(f"    {name:22s} 吸合={on}")
        print(f"    {'':22s} 表示={ind}")
    print(f"\n清理了 {fixed} 条带尾部空格的配置名")
    conn.close()


if __name__ == "__main__":
    main()
