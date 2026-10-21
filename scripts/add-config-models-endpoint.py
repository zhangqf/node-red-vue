"""
在 nr/flows.json 里新增 HTTP 接口 /getConfigModels。

用途：配置（测试机型）在 ZD6 与 ZD9 下各有同名但不同 id 的记录，界面上
分不清某条属于哪个机型。接口按绑定关系（combination_config_bindings ->
combination.deviceType）反查，输出 configId -> deviceType 映射。

未绑定任何组合方式的配置（ZYJ7/ZDJ9/SH6 那几个）从配置名前缀兜底推断，
推不出的置空，前端显示为「未指定」。
"""
import json
import uuid
import shutil
from pathlib import Path

FLOWS = Path(__file__).resolve().parents[1] / "nr" / "flows.json"
TAB = "616b0fbf58fc4465"
GROUP = "14d861217ea12ab5"   # 配置管理组
DB = "a074385e545da94b"      # device.db 配置节点

# 现有 http in 节点的样式模板
HTTP_IN = {
    "type": "http in",
    "z": TAB,
    "g": GROUP,
    "method": "get",
    "upload": False,
    "skipBodyParsing": False,
    "swaggerDoc": "",
    "x": 230,
    "y": 4380,
    "wires": [[]],
}
FUNCTION = {
    "type": "function",
    "z": TAB,
    "g": GROUP,
    "outputs": 1,
    "timeout": 0,
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 560,
    "y": 4380,
    "wires": [[]],
}
SQLITE = {
    "type": "sqlite",
    "z": TAB,
    "g": GROUP,
    "mydb": DB,
    "sqlquery": "msg.topic",
    "sql": "",
    "x": 960,
    "y": 4380,
    "wires": [[]],
}
HTTP_RESPONSE = {
    "type": "http response",
    "z": TAB,
    "g": GROUP,
    "statusCode": "200",
    "headers": {"content-type": "application/json"},
    "x": 1660,
    "y": 4380,
    "wires": [],
}

# 绑定关系反查：binding_id 的格式是 "<deviceId>_<combinationId>"，
# deviceId 里可能带下划线，所以从最后一个下划线切分更稳。
#
# 用 LEFT JOIN 从 config 表出发，未绑定任何组合方式的配置（ZYJ7/ZDJ9/SH6
# 那几个）也能返回，只是没有绑定关系可查，改从配置名前缀兜底推断机型。
# 这样一次查询就能覆盖全部配置，前端不需要再拉一遍配置列表。
QUERY_FUNC = (
    "// 配置 -> 组合方式 -> 机型\n"
    "// binding_id 格式为 \"<deviceId>_<combinationId>\"，\n"
    "// deviceId 本身可能含下划线，故从右侧切分。\n"
    "//\n"
    "// 绑定关系是准的；没绑定的配置（ZYJ7/ZDJ9/SH6 那几个）从名字前缀\n"
    "// 兜底推断，推不出就留空由前端显示「未指定」。\n"
    "msg.topic = `\n"
    "SELECT DISTINCT\n"
    "       cfg.id AS configId,\n"
    "       COALESCE(\n"
    "         cb.deviceType,\n"
    "         CASE\n"
    "           WHEN cfg.name LIKE 'ZDJ9%' THEN 'ZDJ9'\n"
    "           WHEN cfg.name LIKE 'ZYJ7%' THEN 'ZYJ7'\n"
    "           WHEN cfg.name LIKE 'ZD9%'  THEN 'ZD9'\n"
    "           WHEN cfg.name LIKE 'ZD6%'  THEN 'ZD6'\n"
    "           WHEN cfg.name LIKE 'SH6%'  THEN 'ZYJ7'\n"
    "           ELSE ''\n"
    "         END\n"
    "       ) AS deviceType\n"
    "FROM config cfg\n"
    "LEFT JOIN combination_config_bindings ccb\n"
    "  ON ccb.config_id = cfg.id\n"
    "LEFT JOIN combination cb\n"
    "  ON cb.id = substr(ccb.binding_id, instr(ccb.binding_id, '_') + 1)\n"
    "`;\n"
    "return msg;"
)

# 结果整形：把行数组转成 { configId: deviceType } 映射
FORMAT_FUNC = """// 行数组 -> { configId: deviceType } 映射
const rows = msg.payload || [];
const models = {};
for (const r of rows) {
  if (r && r.configId) models[r.configId] = r.deviceType || "";
}

msg.payload = { code: 200, data: models };
return msg;"""


def new_id() -> str:
    return uuid.uuid4().hex[:16]


def main() -> None:
    backup = FLOWS.with_suffix(".json.bak-add-config-models")
    shutil.copy(FLOWS, backup)

    data = json.loads(FLOWS.read_text(encoding="utf-8"))

    if any(
        n.get("type") == "http in" and n.get("url") == "/getConfigModels"
        for n in data
    ):
        print("接口已存在，跳过")
        return

    http_in = {**HTTP_IN, "id": new_id(), "name": "查询配置适用机型",
               "url": "/getConfigModels", "wires": [[]]}
    query = {**FUNCTION, "id": new_id(), "name": "按绑定关系查机型",
             "func": QUERY_FUNC, "wires": [[]]}
    sql = {**SQLITE, "id": new_id(), "name": "查询config对应机型",
           "wires": [[]]}
    fmt = {**FUNCTION, "id": new_id(), "name": "整理机型映射",
           "func": FORMAT_FUNC, "wires": [[]]}
    resp = {**HTTP_RESPONSE, "id": new_id(), "name": "response"}

    http_in["wires"] = [[query["id"]]]
    query["wires"] = [[sql["id"]]]
    sql["wires"] = [[fmt["id"]]]
    fmt["wires"] = [[resp["id"]]]

    data.extend([http_in, query, sql, fmt, resp])

    # 组内节点 id 也要登记
    for n in data:
        if n.get("type") == "group" and n.get("id") == GROUP:
            n.setdefault("nodes", []).extend(
                [http_in["id"], query["id"], sql["id"], fmt["id"], resp["id"]]
            )

    FLOWS.write_text(
        json.dumps(data, ensure_ascii=False, indent=4) + "\n", encoding="utf-8"
    )
    print(f"已新增 /getConfigModels，备份在 {backup.name}")
    print(f"  http in : {http_in['id']}")
    print(f"  function: {query['id']}")
    print(f"  sqlite  : {sql['id']}")
    print(f"  format  : {fmt['id']}")
    print(f"  response: {resp['id']}")


if __name__ == "__main__":
    main()
