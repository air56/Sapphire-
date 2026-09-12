$ErrorActionPreference = 'Stop'

$taskName = 'NeteaseLyricsBridge'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($null -eq $task) {
    Write-Output "未找到登录自启任务：$taskName"
    exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Output "已移除 Bridge 登录自启：$taskName"
