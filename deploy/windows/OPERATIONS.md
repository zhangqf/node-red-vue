# Node-RED 服务操作说明

只跑 `nr\` 目录下的 Node-RED（前端和 Electron 不管），注册成 Windows 服务，开机自启。

> 配套文件：
> - `install-service.bat` —— 首次安装（注册服务）
> - `update.ps1` / `update.bat` —— 日常更新（拉代码 / 重装依赖 / 重启）
> - `uninstall-service.bat` —— 卸载服务
> - `README.md` —— 服务原理与排障细节

---

## 一、当前这台机器上的部署状态

| 项 | 值 |
|---|---|
| 服务名 | `SwitchMachineNR`（显示名 "SwitchMachine Node-RED"） |
| 启动类型 | `AUTO_START` —— 开机即起，**不用登录** |
| 运行账户 | `LocalSystem`（无密码，真正无人值守） |
| 监听地址 | `0.0.0.0:1880` |
| 工作目录 | `C:\switch\node-red-vue\nr` |
| 启动命令 | `<repo>\node_modules\node-red\red.js --settings settings.cjs --userDir .node-red` |
| node.exe | `C:\Users\PC\AppData\Local\Author Software\nvm\installs\v24.14.1\node.exe` |
| 日志 | `deploy\windows\logs\node-red.out.log` / `.err.log` |
| 崩溃重启 | 异常退出后 5 秒自动拉起 |

---

## 二、速查表

```bat
REM 日常最常用的四条
sc query SwitchMachineNR                          REM 看状态
net stop SwitchMachineNR                           REM 停（要管理员）
net start SwitchMachineNR                          REM 起（要管理员）
type deploy\windows\logs\node-red.out.log         REM 看日志
```

一条命令搞定"拉代码 + 装依赖 + 重启"：

```bat
cd /d C:\switch\node-red-vue\deploy\windows
update.bat -Pull -Install
```

---

## 三、场景 A：重新安装依赖

**什么时候用**：`node_modules` 坏了、删了重装、换了台机器、`pnpm-lock.yaml` 变了、装了个新的自定义节点。

### 步骤

```bat
cd /d C:\switch\node-red-vue\deploy\windows
update.bat -Install
```

脚本会依次做完：

1. 停服务（弹 UAC），**等 1880 端口真正释放**
2. `pnpm install --frozen-lockfile` 重装依赖
3. 起服务（弹 UAC），等端口就绪
4. 发一个 HTTP 请求确认真的能响应

### 手工版（脚本不可用时）

```bat
net stop SwitchMachineNR
cd /d C:\switch\node-red-vue
pnpm install
net start SwitchMachineNR
```

### 必须注意的 4 件事

**① 装完依赖一定要重启服务。**
Node-RED 不会热加载。装完不重启，跑的还是旧代码，而且你完全看不出来。

**② `pnpm install` 必须用你平时的账号跑，不要用 SYSTEM。**
用 SYSTEM 跑完，`node_modules` 的属主就变成 SYSTEM 了，之后你自己改不动、删不掉。
`update.bat` 专门把这两步分开：只有停/启服务提权，pnpm 和 git 留在你自己的账号下。

**③ 先停服务再装。**
项目的 `node_modules` 用的是 pnpm 的目录链接（junction）结构。服务正在跑的时候
pnpm 要替换这些目录，Windows 会报"文件被占用"或者直接半路失败。

**④ 装完确认 node-red 版本对不对。**

```bat
node -p "require('C:/switch/node-red-vue/node_modules/node-red/package.json').version"
```

必须是 **4.1.11**（`pnpm-lock.yaml` 锁的版本）。出现别的版本号说明跑成全局安装的那份了，
自定义节点（modbus / sqlite）会加载失败，服务直接崩。

---

## 四、场景 B：项目更新了代码

**什么时候用**：同事推了新代码、`git pull` 之后要生效。

### 步骤

```bat
cd /d C:\switch\node-red-vue\deploy\windows
update.bat -Pull
```

如果这次更新同时动了依赖（`package.json` 改了），就一起跑：

```bat
update.bat -Pull -Install
```

### 关于 `nr/data/device.db` —— 最大的坑

`nr\data\device.db` **是被 git 跟踪的二进制文件**，而运行中的服务一直在往里写测试记录。
这带来两个问题：

**问题 1：`git pull` 会因为它冲突。**

`device.db` 在 `.gitattributes` 里标了 `binary`，git 不会尝试自动合并，冲突了只能手工选。
`update.bat -Pull` 已经帮你处理了：

1. 先把整个 `nr\data` 备份到 `deploy\windows\backup\data-<时间戳>\`
2. 再 `git checkout -- nr/data` 把本地改动还原（数据在备份里，不会丢）
3. 然后才 `git pull`，这样能干净合并

**问题 2：拉完之后，代码里的配置覆盖了本地的运行数据。**
如果你要保留本地数据，把备份里的文件拷回去：

```bat
REM 先看看备份里有什么
dir deploy\windows\backup

REM 确认服务已停再拷
net stop SwitchMachineNR
xcopy deploy\windows\backup\data-20260101-120000\nr\data\* nr\data\ /E /Y
net start SwitchMachineNR
```

### `nr` 分支没有设置 upstream

直接 `git pull` 会报：

```
There is no tracking information for the current branch.
```

所以脚本里写的是 `git pull origin nr`。你手工 pull 的时候也要带上：

```bat
git pull origin nr
```

想一劳永逸地解决：

```bat
git branch --set-upstream-to=origin/nr nr
```

### 手工版

```bat
net stop SwitchMachineNR
cd /d C:\switch\node-red-vue
git pull origin nr
pnpm install
net start SwitchMachineNR
```

---

## 五、场景 C：只改了 flows.json / settings.cjs

不用拉代码、不用装依赖，重启一下就行：

```bat
cd /d C:\switch\node-red-vue\deploy\windows
update.bat
```

**注意：改了 `flows.json` 必须重启才生效。**
Node-RED 编辑器里的"部署"只对当前运行实例有效，改文件必须重启服务。

---

## 六、场景 D：Node 版本变了（nvm 切版本）

**好消息：日常 `nvm use` 切换版本不影响服务。**
服务里写死的是真实二进制路径 `...\nvm\installs\v24.14.1\node.exe`，
你切到哪个版本它都用 v24.14.1，互不干扰。

**坏消息：把 v24.14.1 这个版本卸载了，服务就起不来了。**
（`nvm uninstall 24.14.1`）

```bat
nvm uninstall 24.14.1        REM 卸载了版本
REM -> 服务会崩，log 里是 "No active Node.js version is configured."

REM 修复：把服务指向新的真实路径
deploy\windows\nssm.exe set SwitchMachineNR Application "C:\Users\PC\AppData\Local\Author Software\nvm\installs\v24.0.2\node.exe"
net start SwitchMachineNR
```

> **为什么不用 nvm 的 shim？**
> `C:\Users\PC\AppData\Local\Author Software\nvm\.nodejs\node.exe` 是个转发器，
> 它读的是**当前登录用户**的 nvm 配置。服务以 SYSTEM 身份跑，SYSTEM 没有 nvm 配置，
> 所以它只会打印 `No active Node.js version is configured.` 然后退出 ——
> 这就是 README 里说的 **STATE 7 PAUSED（崩溃重启循环）**。
> 直接指向 `installs\vX.Y.Z\node.exe` 才是真正的二进制，SYSTEM 能正常跑。

---

## 七、场景 E：仓库挪了位置 / 改了目录名

服务里记的是**绝对路径**，挪位置后必须重新注册：

```bat
cd /d <新路径>\deploy\windows
install-service.bat
uninstall-service.bat
```

顺序：**先卸载旧的，再装新的**。`install-service.bat` 会自己删掉同名注册再重装，
所以直接跑它就行，但旧服务指向的旧目录如果已经不存在，卸载会报错，先手动处理。

---

## 八、场景 F：换电脑 / 重装系统

从头走一遍：

```bat
REM 1. 装 Node.js（>= 20.19 或 >= 22.12）和 pnpm
REM 2. 装依赖
cd /d <仓库路径>
pnpm install

REM 3. 注册服务（管理员）
cd /d <仓库路径>\deploy\windows
install-service.bat
grant-permissions.bat
```

再检查一下 node.exe 指向的是不是真实路径（见场景 D）：

```bat
nssm get SwitchMachineNR Application
```

如果指向的是 `...\nvm\.nodejs\node.exe`，改掉：

```bat
nssm set SwitchMachineNR Application "C:\Program Files\nodejs\node.exe"
net start SwitchMachineNR
```

---

## 九、排障

### 先看日志

```bat
type deploy\windows\logs\node-red.out.log
type deploy\windows\logs\node-red.err.log
```

日志会直接告诉你为什么退出。

### 状态是 PAUSED

```
STATE : 7  PAUSED
```

**不是"暂停"，是崩溃重启循环中。** 看日志找原因：

| 日志关键字 | 原因 | 处理 |
|---|---|---|
| `No active Node.js version is configured` | 服务指向了 nvm shim | 见场景 D，改 `Application` 指向真实 node.exe |
| `port in use` | 1880 被别的进程占 | `netstat -ano \| findstr :1880` 找到 PID 后 `taskkill /PID <PID> /F` |
| `failed to open ./data/device.db` | 工作目录不对，或 SYSTEM 没写权限 | 查 `nssm get SwitchMachineNR AppDirectory`；跑 `grant-permissions.bat` |
| `Cannot find module` | 依赖没装 | 仓库根跑 `pnpm install` |
| 版本号不是 4.1.11 | 跑成全局安装的 node-red | 见场景 A 注意事项 ④ |

### 服务起来了但界面查不到设备 / 配置

大概率是工作目录不对，SQLite 开了空库。查日志里这行：

```
[sqlitedb:xxxx] opened ./data/device.db ok
```

- 出现 `opened` → 正常
- 出现 `failed to open ./data/device.db` → 工作目录错了

```bat
nssm get SwitchMachineNR AppDirectory
```

应该指向 `C:\switch\node-red-vue\nr`。

### 改完配置不生效

```bat
net stop SwitchMachineNR && net start SwitchMachineNR
```

### 忘了密码 / 不想用 SYSTEM

`LocalSystem` 不需要密码。如果你想改成指定账号：

```bat
nssm set SwitchMachineNR ObjectName ".\用户名" "密码"
```

改了之后要重新授权目录权限。

---

## 十、必须知道的几个坑

### ① 停/启服务需要管理员权限

用普通 PowerShell 或 cmd 直接敲 `net stop SwitchMachineNR` 会报：

```
[SC] OpenService 失败 5: 拒绝访问。
```

不是服务坏了，是权限不够。`update.bat` 会自动提权（弹 UAC）。

### ② 停服务是异步的

`net stop` 命令**立刻返回**，但服务可能还在慢慢停。这期间 1880 端口还占着，
立刻 `net start` 就会撞 `port in use`。

`update.bat` 会等端口真正释放再继续。手工操作时请先确认：

```bat
netstat -ano | findstr :1880
```

没有输出了再起。

### ③ 启动要等一会儿

| 情况 | 耗时 |
|---|---|
| 日常重启（`nr\.node-red` 已存在） | **约 4 秒** |
| 第一次启动 / `nr\.node-red` 被删了 | **约 75 秒** |

第一次慢是因为 uibuilder 要跑一次 `npm list` 建包索引。开机后前端连不上，
不代表服务坏了，等一会儿再试。

> `install-service.bat` 原本只等 40 秒，首次安装会误报失败。现在已改成等 180 秒。

### ④ `nr\.node-red` 是 gitignore 的

这个目录是 Node-RED 的运行目录（`userDir`），删了不影响功能，只是下次启动变慢。

### ⑤ `pnpm-lock.yaml` 曾经和 `package.json` 不同步（已修）

之前 `package.json` 里删掉了 `cross-env` 依赖，但锁文件里还留着，
`pnpm install --frozen-lockfile` 会直接报错：

```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because
pnpm-lock.yaml is not up to date with package.json
```

**现在已经修好了** —— 重新安装依赖时 `update.bat` 会退回 `--no-frozen-lockfile`
重装，顺手把锁文件同步好。修好后的 `pnpm-lock.yaml` 有改动，**记得提交上去**，
否则别人拉代码还是会遇到同样的问题。

> 顺带一提：`package.json` 的 `electron:dev` 脚本还在用 `cross-env`，
> 但依赖已经不在 `dependencies` 里了。要么把 `cross-env` 加回去，要么改脚本。
> （Electron 那条线不在本项目范围内，留给需要的人处理。）

`update.bat` 里保留了那段退回逻辑，以后再出现锁文件不同步，它会自动兜住。

### ⑥ `nr\data` 是运行数据，但它被 git 跟踪了

服务每跑一次测试就会往 `nr\data\` 里写东西（`device.db`、`records\*.json`、`log`），
所以 `git status` 永远显示这些文件是 modified 的。

这不算"你改了代码"，是正常运行产生的。`update.bat` 会把这类文件和真正的代码改动
分开对待 —— 前者备份后还原，后者则中止脚本，避免覆盖你的未提交修改。

**长期建议**：把运行数据从 git 里摘出去（`git rm --cached nr/data/device.db`），
只保留配置文件版本化。但这会改变团队协作方式，要和同事商量后再做。

---

## 十一、完整命令速查

```bat
REM === 安装 ===
cd /d C:\switch\node-red-vue\deploy\windows
install-service.bat
grant-permissions.bat

REM === 日常 ===
update.bat                      REM 只重启
update.bat -Install             REM 重装依赖 + 重启
update.bat -Pull                REM 拉代码 + 重启
update.bat -Pull -Install       REM 拉代码 + 重装依赖 + 重启（最常用）
update.bat -Pull -Force         REM 忽略本地修改强行拉

REM === 手工控制（管理员） ===
net stop SwitchMachineNR
net start SwitchMachineNR
sc query SwitchMachineNR
nssm edit SwitchMachineNR       REM 图形界面改配置

REM === 卸载 ===
uninstall-service.bat

REM === 看日志 ===
type deploy\windows\logs\node-red.out.log
```

### `update.bat` 参数

| 参数 | 说明 |
|---|---|
| `-Pull` | 执行 `git pull origin nr` |
| `-Install` | 执行 `pnpm install` |
| `-Branch <名字>` | 远端分支，默认 `nr` |
| `-NoStart` | 更新完不启动服务 |
| `-Force` | 有本地修改也继续 |
