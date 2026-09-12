$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectPath = Join-Path $repoRoot 'src\NeteaseLyricsBridge\NeteaseLyricsBridge.csproj'
$endpoint = 'http://127.0.0.1:18763/'
$logRoot = Join-Path $env:LOCALAPPDATA 'NeteaseLyricsBridge'
$stdoutPath = Join-Path $logRoot 'bridge.stdout.log'
$stderrPath = Join-Path $logRoot 'bridge.stderr.log'

if (-not (Test-Path -LiteralPath $projectPath -PathType Leaf)) {
    throw "找不到 Bridge 项目：$projectPath"
}

# 登录时可能重复触发任务；如果已有 Bridge 在监听，不再启动第二个实例。
try {
    $response = Invoke-WebRequest -Uri $endpoint -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        exit 0
    }
} catch {
    # Bridge 尚未启动，继续启动流程。
}

$dotnet = Get-Command dotnet.exe -ErrorAction SilentlyContinue
if ($null -eq $dotnet) {
    throw '找不到 dotnet.exe。请安装 .NET 8 SDK，或在重新登录前确保 dotnet 已加入 PATH。'
}

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

Start-Process `
    -FilePath $dotnet.Source `
    -ArgumentList @('run', '--project', $projectPath, '--no-launch-profile') `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath
