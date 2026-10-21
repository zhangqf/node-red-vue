"""
在 nr/flows.json 里新增 HTTP 接口 /getWiringTypes。

用途：选型页要按「有无外部配线」给组合方式分组。分组依据存在
combination_wiring 表里（组合方式 -> 配线类型），现有接口都不返回它。

返回结构：
  { "<combinationId>": "有外部配线" | "无外部配线" }

只返回有配线类型记录的组合方式；没记录的（ZYJ7/ZDJ9 等机型）不在返回里，
前端按「不分组」处理。
"""
import json
import shutil
import uuid
from pathlib import Path

FLOWS = Path(__file__).resolve().parents[1] / "nr" / "flows.json"
TAB = "616b0fbf58fc4465"
GROUP = "14d861217ea12ab5"   # 配置管理组
DB = "a074385e545da94b"      # device.db 配置节点

HTTP_IN = {
    "type": "http in",
    "z": TAB,
    "g": GROUP,
    "method": "get",
    "upload": False,
    "skipBodyParsing": False,
    "swaggerDoc": "",
    "x": 230,
    "y": 4620,
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
    "y": 4620,
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
    "y": 4620,
    "wires": [[]],
}
HTTP_RESPONSE = {
    "type": "http response",
    "z": TAB,
    "g": GROUP,
    "statusCode": "200",
    "headers": {"content-type": "application/json"},
    "x": 1660,
    "y": 4620,
    "wires": [],
}

QUERY_FUNC = (
    "// 组合方式 -> 配线类型（有无外部配线）\n"
    "// 选型页据此把组合方式分组展示。\n"
    "msg.topic = `\n"
    "SELECT combination_id AS combinationId, wiring_type AS wiringType\n"
    "FROM combination_wiring\n"
    "`;\n"
    "return msg;"
)

FORMAT_FUNC = """// 行数组 -> { combinationId: wiringType }
const rows = msg.payload || [];
const types = {};
for (const r of rows) {
  if (r && r.combinationId) types[r.combinationId] = r.wiringType || "";
}

msg.payload = { code: 200, data: types };
return msg;"""


def new_id() -> str:
    return uuid.uuid4().hex[:16]


def main() -> None:
    backup = FLOWS.with_suffix(".json.bak-add-wiring-types")
    shutil.copy(FLOWS, backup)

    data = json.loads(FLOWS.read_text(encoding="utf-8"))

    if any(
        n.get("type") == "http in" and n.get("url") == "/getWiringTypes"
        for n in data
    ):
        print("接口已存在，跳过")
        return

    http_in = {**HTTP_IN, "id": new_id(), "name": "查询组合方式配线类型",
               "url": "/getWiringTypes", "wires": [[]]}
    query = {**FUNCTION, "id": new_id(), "name": "按组合方式查配线类型",
             "func": QUERY_FUNC, "wires": [[]]}
    sql = {**SQLITE, "id": new_id(), "name": "查询配线类型表",
           "wires": [[]]}
    fmt = {**FUNCTION, "id": new_id(), "name": "整理配线类型映射",
           "func": FORMAT_FUNC, "wires": [[]]}
    resp = {**HTTP_RESPONSE, "id": new_id(), "name": "response"}

    http_in["wires"] = [[query["id"]]]
    query["wires"] = [[sql["id"]]]
    sql["wires"] = [[fmt["id"]]]
    fmt["wires"] = [[resp["id"]]]

    data.extend([http_in, query, sql, fmt, resp])

    for n in data:
        if n.get("type") == "group" and n.get("id") == GROUP:
            n.setdefault("nodes", []).extend(
                [http_in["id"], query["id"], sql["id"], fmt["id"], resp["id"]]
            )

    FLOWS.write_text(
        json.dumps(data, ensure_ascii=False, indent=4) + "\n", encoding="utf-8"
    )
    print(f"已新增 /getWiringTypes，备份在 {backup.name}")
    print(f"  http in : {http_in['id']}")
    print(f"  function: {query['id']}")
    print(f"  sqlite  : {sql['id']}")
    print(f"  format  : {fmt['id']}")
    print(f"  response: {resp['id']}")


if __name__ == "__main__":
    main()
