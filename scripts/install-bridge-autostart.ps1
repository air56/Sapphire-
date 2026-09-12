$ErrorActionPreference = 'Stop'

$taskName = 'NeteaseLyricsBridge'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$startScript = Join-Path $PSScriptRoot 'start-bridge.ps1'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path -LiteralPath $startScript -PathType Leaf)) {
    throw "找不到启动脚本：$startScript"
}

$actionArguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $startScript
$action = New-ScheduledTaskAction `
    -Execute $powershell `
    -Argument $actionArguments `
    -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal `
    -UserId $userId `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description '登录 Windows 后自动启动网易云歌词 Bridge（仅监听本机 127.0.0.1:18763）。' `
    -Force | Out-Null

Write-Output "已设置 Bridge 登录自启：$taskName"
Write-Output "启动脚本：$startScript"
Write-Output '重新登录 Windows 后会自动运行，也可以在任务计划程序中手动运行该任务。'
