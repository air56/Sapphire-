$ErrorActionPreference = 'Stop'

$versionText = (& dotnet --version 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($versionText)) {
    throw '需要 .NET 8 SDK 或更高版本。'
}
try { $major = [int](($versionText -split '\.')[0]) } catch { $major = 0 }
if ($major -lt 8) { throw "需要 .NET 8 SDK 或更高版本，当前版本为 $versionText。" }

dotnet run --project (Join-Path $PSScriptRoot '..\src\NeteaseLyricsBridge\NeteaseLyricsBridge.csproj')
