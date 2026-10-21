<#
.SYNOPSIS
    更新 Node-RED 服务：拉取代码 / 重装依赖 / 重启服务。

.DESCRIPTION
    这个脚本把"改代码 -> 装依赖 -> 重启服务"整条链路串起来，避免手工
    操作时漏步骤（尤其是"装完依赖忘了重启"这种，Node-RED 不会热加载）。

    关键设计：
      1. 停/启服务需要管理员权限，但 pnpm install / git pull 必须用
         当前用户跑（否则 node_modules 属主会变成 SYSTEM，之后你自己
         改不动）。所以脚本在非管理员态下会分段提权：只有碰服务的那
         两步走提权子进程，中间那步留在原进程。
      2. 停服务是异步的。必须等到 1880 端口真正释放，否则重新启动会
         撞 "port in use"。
      3. nr\data\device.db 是被 git 跟踪的二进制文件，而运行中的服务
         一直在写它。拉代码前先停服务并备份，避免把库文件写坏，或者
         pull 时产生无法自动合并的二进制冲突。

.PARAMETER Install
    执行 pnpm install --frozen-lockfile（重装/修复依赖）。

.PARAMETER Pull
    执行 git pull origin <Branch>（拉取远端代码）。

.PARAMETER Branch
    远端分支名，默认 nr。

.PARAMETER NoStart
    更新完成后不启动服务（只做更新，自己再手动起）。

.PARAMETER Force
    即使工作区有未提交的修改也继续（默认会中止并提示）。

.EXAMPLE
    .\update.ps1 -Pull -Install
    拉代码 + 重装依赖 + 重启服务（最常用）

.EXAMPLE
    .\update.ps1
    只重启服务（改了 flows.json 之后用）
#>
[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$Pull,
    [switch]$NoStart,
    [switch]$Force,
    [string]$Branch = "nr"
)

$ErrorActionPreference = "Continue"

# ---------------------------------------------------------------- 控制台编码
#
# 中文 Windows 的 cmd.exe 默认代码页是 936(GBK)，而本脚本按 UTF-8 读取，
# 直接输出会出现乱码。把控制台切到 UTF-8，结束时再切回去。
$origEncoding = [Console]::OutputEncoding
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

# ---------------------------------------------------------------- 常量

$ServiceName = "SwitchMachineNR"
$Port        = 1880
$RepoRoot    = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$NrDir       = Join-Path $RepoRoot "nr"
$LogDir      = Join-Path $PSScriptRoot "logs"
$BackupDir   = Join-Path $PSScriptRoot "backup"
$Nssm        = Join-Path $PSScriptRoot "nssm.exe"

# 提权子进程的输出落点
$outFile    = Join-Path ([IO.Path]::GetTempPath()) "nr-elevated.out.txt"

# ---------------------------------------------------------------- 工具函数

function Write-Step  { param($m) Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok    { param($m) Write-Host "[OK] $m" -ForegroundColor Green }
function Write-Warn2 { param($m) Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err2  { param($m) Write-Host "[ERROR] $m" -ForegroundColor Red }

function Test-Elevated {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    (New-Object Security.Principal.WindowsPrincipal $id).
        IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-ListeningPid {
    # 复用 .bat 脚本里的判定方式，保证行为一致
    $hit = & netstat -ano | Select-String ":$Port\s.*LISTENING"
    if (-not $hit) { return $null }
    $parts = ($hit | Select-Object -First 1).ToString().Trim() -split '\s+'
    return $parts[-1]
}

function Test-SvcState {
    param([string]$Wanted)
    $q = & sc.exe query $ServiceName 2>&1 | Out-String
    if ($q -match "STATE\s+:\s+(\d+)") { return $Matches[1] }
    return $null
}

function Invoke-Elevated {
    <#
      以管理员身份跑一段 PowerShell 代码，把输出写到 $OutFile。
      子进程结束后返回其 stdout 文本。
    #>
    param(
        [Parameter(Mandatory)][string]$Body,
        [Parameter(Mandatory)][string]$OutFile
    )

    $child = Join-Path ([IO.Path]::GetTempPath()) ("nr-svc-" + [guid]::NewGuid().ToString("N") + ".ps1")
    # 生成的子脚本：把 $Body 的输出重定向到 $OutFile
    $script = @"
`$ErrorActionPreference = 'Continue'
try {
$Body
} catch {
    "ERROR: `$(`$_ | Out-String)" | Out-File -FilePath '$OutFile' -Encoding UTF8
}
"@
    Set-Content -Path $child -Value $script -Encoding UTF8

    try {
        $exe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
        Start-Process -FilePath $exe `
            -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $child `
            -Verb RunAs -Wait | Out-Null
    } finally {
        Remove-Item $child -Force -ErrorAction SilentlyContinue
    }

    if (Test-Path $OutFile) {
        return (Get-Content $OutFile -Raw -ErrorAction SilentlyContinue)
    }
    return ""
}

function Stop-ServiceSafely {
    <# 停服务并等端口释放。返回 $true 表示确实停了。 #>
    $body = @"
& sc.exe stop '$ServiceName' | Out-String | Out-File -FilePath '__OUT__' -Encoding UTF8
`$sw = [Diagnostics.Stopwatch]::StartNew()
while (`$sw.Elapsed.TotalSeconds -lt 90) {
    `$hit = & netstat -ano | Select-String ':$Port\s.*LISTENING'
    if (-not `$hit) { break }
    Start-Sleep -Milliseconds 500
}
('port_released_after=' + [math]::Round(`$sw.Elapsed.TotalSeconds, 1)) |
    Out-File -FilePath '__OUT__' -Append -Encoding UTF8
"@
    $body = $body -replace '__OUT__', $outFile
    $text = Invoke-Elevated -Body $body -OutFile $outFile
    Write-Host $text

    return (-not (Get-ListeningPid))
}

function Start-ServiceSafely {
    <# 启服务并等端口就绪。返回 $true 表示端口起来了。 #>
    $body = @"
& sc.exe start '$ServiceName' | Out-String | Out-File -FilePath '__OUT__' -Encoding UTF8
`$sw = [Diagnostics.Stopwatch]::StartNew()
while (`$sw.Elapsed.TotalSeconds -lt 180) {
    `$hit = & netstat -ano | Select-String ':$Port\s.*LISTENING'
    if (`$hit) { break }
    Start-Sleep -Seconds 2
}
('port_up_after=' + [math]::Round(`$sw.Elapsed.TotalSeconds, 1)) |
    Out-File -FilePath '__OUT__' -Append -Encoding UTF8
& sc.exe query '$ServiceName' | Out-String | Out-File -FilePath '__OUT__' -Append -Encoding UTF8
"@
    $body = $body -replace '__OUT__', $outFile
    $text = Invoke-Elevated -Body $body -OutFile $outFile
    Write-Host $text

    return [bool](Get-ListeningPid)
}

function Backup-Data {
    <# 备份 nr\data。拉代码前调用。 #>
    if (-not (Test-Path (Join-Path $NrDir "data"))) { return $null }
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $dest  = Join-Path $BackupDir "data-$stamp"
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Copy-Item (Join-Path $NrDir "data") $dest -Recurse -Force
    Write-Ok "已备份 nr\data -> $dest"
    return $dest
}

# ---------------------------------------------------------------- 前置检查

Write-Host ""
Write-Host "  SwitchMachine Node-RED  更新工具" -ForegroundColor White
Write-Host "  仓库: $RepoRoot" -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-Path $NrDir)) {
    Write-Err2 "找不到 $NrDir，仓库路径不对。"
    exit 1
}

$state = Test-SvcState
if (-not $state) {
    Write-Err2 "服务 '$ServiceName' 未注册。先跑 install-service.bat（管理员）。"
    exit 1
}
$stateText = if ($state -eq "4") { "RUNNING" } else { "STATE $state" }
Write-Step "服务当前状态: $stateText"

if (-not (Test-Elevated)) {
    Write-Warn2 "当前不是管理员。停/启服务会自动提权（会弹 UAC）。"
    Write-Warn2 "pnpm / git 步骤仍然以当前用户运行，不会动 node_modules 的属主。"
}

# ---------------------------------------------------------------- 主流程
#
# 用 try/finally 而不是一串 exit：任何一步出错都必须把服务拉回来。
# 脚本中途失败却把服务留在"停着"的状态，是最糟的结果 -- 现场就没了。

$serviceStopped = $false
$exitCode      = 0

try {
    # ------------------------------------------------------------ 1. 停服务

    $needRestart = ($Install -or $Pull -or -not $NoStart)
    if ($needRestart) {
        Write-Step "停止服务 ..."
        if (Stop-ServiceSafely) {
            $serviceStopped = $true
            Write-Ok "服务已停止，端口 $Port 已释放。"
        } else {
            Write-Err2 "服务没能停下来（端口 $Port 仍被占用）。"
            Write-Err2 "查一下是不是有别的 Node-RED 实例："
            Write-Err2 "    netstat -ano | findstr :$Port"
            Write-Err2 "    taskkill /PID <PID> /F"
            throw "服务未能停止"
        }
    }

    # ------------------------------------------------------------ 2. 拉代码

    if ($Pull) {
        Write-Step "拉取代码 (origin/$Branch) ..."

        # 工作区分两类看：
        #   nr\data\  -> 运行数据（服务一直在写 device.db / records），
        #                 脏是正常的。先备份再还原，让 pull 能干净合并。
        #   其它文件   -> 真正的代码改动，有本地修改就中止，别覆盖。
        $statusAll = & git -C $RepoRoot status --porcelain 2>&1 | Out-String
        $dirtyLines = @($statusAll -split "`n" |
                        ForEach-Object { $_.Trim() } |
                        Where-Object { $_ -ne "" })
        $runtimeDirty = @($dirtyLines | Where-Object { $_ -match "nr/data/" })
        $codeDirty    = @($dirtyLines | Where-Object { $_ -notmatch "nr/data/" })

        if ($codeDirty.Count -gt 0 -and -not $Force) {
            Write-Warn2 "以下文件有本地修改："
            $codeDirty | ForEach-Object { Write-Warn2 "    $_" }
            Write-Err2 "为避免丢改动，脚本中止。"
            Write-Err2 "处理完（commit / stash / checkout）再跑，或加 -Force 强制继续。"
            throw "工作区不干净"
        }

        if ($runtimeDirty.Count -gt 0) {
            Write-Warn2 "检测到运行数据有本地改动（服务写入的，正常）："
            $runtimeDirty | Select-Object -First 5 | ForEach-Object { Write-Warn2 "    $_" }
            if ($runtimeDirty.Count -gt 5) {
                Write-Warn2 "    ... 另有 $($runtimeDirty.Count - 5) 项"
            }
        }

        # 无论如何都先备份一次
        Write-Step "备份 nr\data（device.db 是被 git 跟踪的二进制文件）..."
        $null = Backup-Data

        if ($runtimeDirty.Count -gt 0) {
            Write-Step "还原 nr\data 的本地改动，让 pull 能干净合并 ..."
            & git -C $RepoRoot checkout -- nr/data 2>&1 | Out-Null
            Write-Ok "已还原（原数据在备份目录里，需要时可手动拷回）"
        }

        $pullOut = & git -C $RepoRoot pull origin $Branch 2>&1 | Out-String
        Write-Host $pullOut

        if ($LASTEXITCODE -ne 0) {
            Write-Warn2 "git pull 失败。"
            Write-Warn2 "如果报的是 device.db 的二进制冲突，按下面处理："
            Write-Warn2 "    git checkout --theirs nr/data/device.db   # 用远端版本（跟随代码更新）"
            Write-Warn2 "    git checkout --ours   nr/data/device.db   # 保留本地运行数据"
            Write-Warn2 "    git add nr/data/device.db && git rebase --continue"
            Write-Warn2 "备份在 $BackupDir 目录里。"
            throw "git pull 失败"
        }
        Write-Ok "代码已更新到 origin/$Branch。"
    }

    # ------------------------------------------------------------ 3. 装依赖

    if ($Install) {
        Write-Step "安装依赖 (pnpm install --frozen-lockfile) ..."

        $pnpm = (Get-Command pnpm -ErrorAction SilentlyContinue).Source
        if (-not $pnpm) {
            Write-Err2 "找不到 pnpm。请先装好 pnpm，或在仓库根手动跑 pnpm install。"
            throw "找不到 pnpm"
        }

        Push-Location $RepoRoot
        try {
            # 优先用 --frozen-lockfile：保证装出来的版本和锁文件完全一致。
            # 但锁文件跟 package.json 不同步时它会直接失败（很常见，比如
            # 有人改了 package.json 却忘了重新生成锁文件），这时退回
            # --no-frozen-lockfile，让 pnpm 顺带把锁文件修好。
            $installOut = & $pnpm install --frozen-lockfile 2>&1 | Out-String
            $installOk  = ($LASTEXITCODE -eq 0)

            if (-not $installOk) {
                if ($installOut -match "ERR_PNPM_OUTDATED_LOCKFILE") {
                    Write-Warn2 "pnpm-lock.yaml 和 package.json 不同步。"
                    Write-Warn2 "改用 --no-frozen-lockfile 重装，锁文件会被一并更新。"
                    Write-Warn2 "（更新后的 pnpm-lock.yaml 记得提交，否则别人也会遇到）"
                    Write-Step "重新安装依赖 ..."
                    $installOut = & $pnpm install --no-frozen-lockfile 2>&1 | Out-String
                    $installOk  = ($LASTEXITCODE -eq 0)
                }
            }

            Write-Host $installOut
            if (-not $installOk) {
                Write-Err2 "pnpm install 失败。"
                throw "pnpm install 失败"
            }
        } finally {
            Pop-Location
        }

        # 确认服务要用的那份 node-red 还在
        $red = Join-Path $RepoRoot "node_modules\node-red\red.js"
        if (-not (Test-Path $red)) {
            Write-Err2 "node_modules\node-red\red.js 不见了，pnpm install 可能没装全。"
            throw "node-red 缺失"
        }

        # 版本要从 package.json 读。
        # 千万别 require('.../red.js') —— red.js 是启动入口，require 它
        # 会把整个 Node-RED 服务跑起来（占住 1880 端口）然后永不退出。
        $pkg = Join-Path $RepoRoot "node_modules\node-red\package.json"
        $pkgJs = $pkg -replace '\\', '/'
        $ver = & node -p "require('$pkgJs').version" 2>&1 | Out-String
        Write-Ok "项目内 node-red 版本: $($ver.Trim())"
        Write-Ok "依赖安装完成。"
    }
}
catch {
    $exitCode = 1
    Write-Err2 $_.Exception.Message
}
finally {
    # ---------------------------------------------------------- 4. 启服务
    #
    # 无论前面成功还是失败，只要服务被停掉了、又没要求保持停止，就一定
    # 把它拉回来。唯一例外是仓库还处在合并冲突状态 -- 那时候 flows.json
    # 可能带着冲突标记，起服务只会陷入崩溃重启循环，不如先让人处理。

    if ($serviceStopped -and -not $NoStart) {
        $unmerged = @()
        if (Test-Path (Join-Path $RepoRoot ".git")) {
            $unmerged = & git -C $RepoRoot diff --name-only --diff-filter=U 2>$null |
                        Where-Object { $_ }
        }

        if ($unmerged.Count -gt 0) {
            Write-Err2 "仓库处于合并冲突状态，先不启动服务："
            $unmerged | ForEach-Object { Write-Err2 "    $_" }
            Write-Err2 "处理完冲突后手动执行： sc start $ServiceName"
            $exitCode = 1
        } else {
            Write-Step "启动服务 ..."
            if (Start-ServiceSafely) {
                Write-Ok "服务已启动，端口 $Port 正在监听。"
                try {
                    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 20
                    Write-Ok "HTTP 检查通过 (状态码 $($resp.StatusCode))"
                } catch {
                    Write-Warn2 "端口在监听，但 HTTP 请求失败：$($_.Exception.Message)"
                }
            } else {
                Write-Err2 "服务启动了，但端口 $Port 没起来。"
                Write-Err2 "看日志： Get-Content '$LogDir\node-red.out.log' -Tail 50"
                Write-Err2 "      Get-Content '$LogDir\node-red.err.log' -Tail 50"
                $exitCode = 1
            }
        }
    }
}

if ($exitCode -eq 0) {
    Write-Host ""
    Write-Ok "完成。"
    Write-Host ""
}

# 还原控制台代码页
try { [Console]::OutputEncoding = $origEncoding } catch { }
exit $exitCode
