# Windows 开机自启部署

把 Node-RED 后端注册成 Windows 服务，开机自动拉起，不需要人工登录。

> 适用范围：本目录脚本用于 **独立跑 Node-RED** 的场景（前端在别的设备上连 1880）。
> 如果用 Electron 打包版，Node-RED 由 Electron 进程内启动，不需要这套脚本。

> 📖 **日常操作、重装依赖、拉代码更新、排障步骤** 请看 **[OPERATIONS.md](OPERATIONS.md)**。
> 本文只讲服务本身的原理和配置，命令怎么用看那份。

---

## 文件说明

| 文件 | 作用 |
|---|---|
| `OPERATIONS.md` | **操作说明**：重装依赖 / 拉代码 / 换机器 / 排障的分步操作 |
| `update.ps1` / `update.bat` | 日常更新：拉代码 / 重装依赖 / 重启服务 |
| `run-nr.bat` | 前台启动 Node-RED（排障用），自动切到正确的���作目录 |
| `install-service.bat` | 注册 Windows 服务并启动（**管理员**运行） |
| `uninstall-service.bat` | 卸载服务（**管理员**运行） |
| `grant-permissions.bat` | 给 SYSTEM 账户授予 `nr\` 写权限（**管理员**运行，装完服务跑一次） |
| `nssm.exe` | NSSM（Non-Sucking Service Manager）2.24 win64 |

---

## 三条命令搞定

在 **管理员** 命令提示符里，依次执行：

```bat
cd /d C:\switch\node-red-vue\deploy\windows

install-service.bat
grant-permissions.bat
```

第一条注册服务并启动，第二条补权限。顺序不能反（服务启动时就要能写 `nr\data`）。

`install-service.bat` 结束时会**自动验证**：等 40 秒看 1880 端口有没有起来。
成功会打印 `[OK] ... is running and listening on port 1880`；
失败则打印服务状态 + 两份日志的全文 + 常见原因对照表。

手动验证：

```bat
sc query SwitchMachineNR
```

看到 `STATE : 4 RUNNING` 就成了。

---

## ⚠️ STATE 7 PAUSED 是什么意思

```
STATE : 7  PAUSED
```

**不是"暂停"，是"崩溃重启循环中"**。NSSM 在进程反复异常退出时会进入退避等待，
此时把服务状态标成 `PAUSED`（源码 `service.cpp:1878` 的 `throttle_restart()`）。

```bash
# NSSM 源码里的原文
service->status.dwCurrentState = SERVICE_PAUSED;
```

所以看到 PAUSED 就意味着：**Node-RED 起来就崩，NSSM 在反复重试**。
直接看日志定位原因：

```bat
type logs\node-red.out.log
type logs\node-red.err.log
```

> 注意日志目录的相对路径。脚本在 `deploy\windows` 下，所以是 `logs\xxx.log`；
> 如果你已经 cd 到仓库根，才是 `deploy\windows\logs\xxx.log`。

### 崩溃重启循环的常见原因

| 日志关键字 | 原因 | 处理 |
|---|---|---|
| `port in use` | 1880 被别的进程占 | `netstat -ano \| findstr :1880` 找到 PID 后杀掉 |
| `failed to open ./data/device.db` | 工作目录不对，或 SYSTEM 没写权限 | 查 `AppDirectory`；跑 `grant-permissions.bat` |
| `Cannot find module` | 项目依赖没装 | 在仓库根跑 `pnpm install` |
| 版本号不是 4.1.11 | 跑成了全局安装的 node-red | 见下 |

---

## ⚠️ 必须用项目里的 node-red，不能用全局安装的

这是最容易踩的坑，而且**症状很隐蔽**。

```bat
npm i -g node-red          # 装的是最新版（现在是 5.x）
node-red                   # 跑的是全局那份
```

全局安装的 Node-RED 从**自己的安装目录**向上扫描 `node_modules` 找自定义节点，
永远不会找到项目的 `node-red-contrib-modbus` / `node-red-node-sqlite`。
结果就是流程加载失败、服务崩溃重启。

项目声明的是 `"node-red": "^4.1.0"`，`pnpm-lock.yaml` 锁定 **4.1.11**。
**日志里出现别的版本号就说明跑错了。**

服务始终使用：

```
<repo>\node_modules\node-red\red.js
```

`install-service.bat` 启动前会打印项目实际的版本，并在检测到全局 `node-red`
时给出 `[WARN]` 提示。

### nvm-windows 的额外坑

如果用 nvm-windows 管理 Node，全局包和 nvm 一样按版本存放：

```
C:\Users\PC\AppData\Local\Author Software\nvm\.nodejs\node.exe       ← 当前版本
C:\Users\PC\AppData\Local\Author Software\nvm\.nodejs\node-red.exe   ← 全局 node-red
```

`.nodejs` 是指向具体版本目录的符号链接。这意味着：

- **`node-red` 命令的版本会跟着 nvm 切换的版本变**，服务用的却是仓库里
  固定的那份 —— 两者很容易对不上
- 切换 nvm 版本后，全局 `node-red` 可能就找不到了（那是好事）
- 但如果全局装过 `node-red`，在某个版本下它会复活并带来困惑

**建议直接卸载全局副本**：

```bat
npm uninstall -g node-red
```

服务不依赖它，只用仓库里的那份。

---

## 关键配置说明

### 工作目录（最容易踩的坑）

`flows.json` 里的 SQLite 节点用的是**相对路径**：

```json
{ "type": "sqlitedb", "db": "./data/device.db" }
```

相对的是**进程工作目录**。Windows 服务的默认工作目录是 `C:\Windows\System32`，
一旦工作目录不对，SQLite 会在那边建一个空库，表现为"设备/配置全都查不到"。

脚本里通过 `AppDirectory` 显式锁定：

```
nssm set SwitchMachineNR AppDirectory "D:\path\to\switch-machine-nr\nr"
```

另外 `settings.cjs` 里的 `rootPath` 已经是绝对路径（`nrDir`），只有 SQLite 节点
还在用相对路径。**改工作目录比改 flows.json 更保险**，因为 flows.json 是运行时
可能被编辑器覆盖的文件。

> 实测：工作目录错误时日志里会出现
> `[error] [sqlitedb:xxx] failed to open ./data/device.db`，
> 属于显式报错，不会静默建空库。

### AppParameters 用相对路径

```
nssm set SwitchMachineNR AppParameters "..\node_modules\node-red\red.js --settings settings.cjs --userDir .node-red"
```

`AppParameters` 在注册表里是一个整串，服务启动时被 Windows 重新解析。
如果路径写成绝对且含空格（`D:\My Projects\...`），内嵌引号极易被拆散。

改用**相对于 `AppDirectory` 的相对路径**后，完全不需要内嵌引号，
含空格的仓库路径也能正常工作。

Node-RED 的 `red.js` 用 `path` 模块解析 `--settings` / `--userDir` 参数
（`red.js:62-64` 的 `"settings": [path]`），会自动按 **cwd** 展开成绝对路径，
所以相对路径是安全的。

### 日志

`settings.cjs` 只配了 console 输出：

```js
logging: { console: { level: "info", metrics: false, audit: false } }
```

服务没有控制台，日志会全部丢失。脚本把 stdout/stderr 重定向到：

```
deploy\windows\logs\node-red.out.log
deploy\windows\logs\node-red.err.log
```

stdout 日志超过 10MB 自动轮转。

### 崩溃重启

```
nssm set SwitchMachineNR AppExit Default Restart
nssm set SwitchMachineNR AppRestartDelay 5000
```

进程异常退出（崩溃、端口被占、内存不足）5 秒后自动拉起。

### 停止方式

`red.js` 注册了 `SIGINT` / `SIGTERM` / `SIGBREAK` 处理器（`red.js:552-556`），
可以优雅停机。脚本用 `AppStopMethodConsole` 而不是强杀，给 15 秒收尾时间。

### 运行账户

`LocalSystem`（SYSTEM）。真正的无人值守 —— 不需要存密码，也不管有没有人登录。
代价是 Node-RED 的 `userDir` 会落到 `C:\Windows\System32\config\systemprofile`，
所以脚本用 `--userDir .node-red` 显式指到 `nr\.node-red`，让所有运行时文件都在仓库里
（该目录已加入 `.gitignore`）。

### 启动类型

`SERVICE_AUTO_START` —— 开机即起，**在用户登录之前**。

> 如果 `127.0.0.1:502` 的 Modbus 网关是**同一台机器**上的另一个服务，
> 网关可能还没起来。Node-RED 侧配了 `reconnectOnTimeout: true` +
> `reconnectTimeout: 2000`，会自动重连，只是启动瞬间会刷一批错误日志。
> 想彻底避免就改成延迟启动：
> ```
> nssm set SwitchMachineNR Start SERVICE_DELAYED_AUTO_START
> ```

---

## 日常运维

```bat
net stop SwitchMachineNR      REM 停止
net start SwitchMachineNR     REM 启动
sc query SwitchMachineNR      REM 查看状态
```

改完 `flows.json` 后重启才生效：

```bat
net stop SwitchMachineNR && net start SwitchMachineNR
```

查看日志：

```bat
type deploy\windows\logs\node-red.out.log
```

---

## 排障

**先看日志** —— 它会直接告诉你为什么退出：

```bat
cd C:\switch\node-red-vue\deploy\windows
type logs\node-red.out.log
type logs\node-red.err.log
```

> 日志的相对路径取决于你在哪个目录。脚本在 `deploy\windows` 下，所以是
> `logs\xxx.log`；站在仓库根才是 `deploy\windows\logs\xxx.log`。

### 端口被占用

```
[error] Unable to listen on http://0.0.0.0:1880/
[error] Error: port in use
```

说明还有一个 Node-RED 实例在跑（多半是手工 `run-nr.bat` 起的，或者 Electron 版）。

```bat
netstat -ano | findstr :1880
tasklist /FI "PID eq <上面查到的PID>"
taskkill /PID <PID> /F
```

### 界面查不到设备/配置

大概率是工作目录不对、SQLite 开了空库。检查日志里这行：

```
[sqlitedb:xxxx] opened ./data/device.db ok
```

- 出现 `opened` → 正常
- 出现 `failed to open ./data/device.db` → 工作目录错了

确认配置：

```bat
nssm get SwitchMachineNR AppDirectory
```

应该指向 `C:\switch\node-red-vue\nr`。

### 服务起不来

```bat
nssm get SwitchMachineNR Application
nssm get SwitchMachineNR AppParameters
nssm get SwitchMachineNR AppDirectory
```

对比 `install-service.bat` 里设置的值。

`nssm.exe` 可以直接带 `get` / `set` / `start` / `stop` / `edit`（图形界面），
排查时 `nssm edit SwitchMachineNR` 最直观。

### 状态显示 PAUSED

不是"暂停"，是崩溃重启循环中，见上面「STATE 7 PAUSED 是什么意思」。

---

## 卸载

```bat
uninstall-service.bat
```

会停服务、删注册、清日志目录。**仓库内容（flows.json、data\device.db）不受影响。**

---

## 备选方案：Windows 计划任务

不想引入 NSSM 的话，任务计划程序也能做到开机自启：

```
schtasks /create /tn SwitchMachineNR /tr "<run-nr.bat 的完整路径>" /sc onstart /ru SYSTEM /rl HIGHEST
```

但有两个短板：

1. **崩溃重启要手动配**（任务计划程序界面里设"如果任务失败，每 1 分钟重启"）
2. **没有 stdout 捕获**，日志得自己在 bat 里重定向

所以默认给的是 NSSM 方案。

---

## 附：为什么不能直接用 `sc create`

```bat
sc create SwitchMachineNR binPath= "node.exe red.js ..."
```

会报 `错误 1053：服务未响应连接或控制命令`。

`sc create` 只能注册实现了服务控制协议（SCM）接口的程序，`node-red` 是普通控制台
程序，不响应 SCM 的启动/停止指令。NSSM 就是这层垫片：它本身是合规的服务，
负责接收 SCM 指令，再用子进程拉起 node 并转发信号。
