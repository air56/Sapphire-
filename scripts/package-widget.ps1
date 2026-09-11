$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$widgetRoot = Join-Path $repoRoot 'widgets/netease-lyrics-glass'
$distRoot = Join-Path $repoRoot 'dist'
$metadataPath = Join-Path $widgetRoot 'metadata.json'
$metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
$version = ([string]$metadata.version).Trim()
if ([string]::IsNullOrWhiteSpace($version)) { throw 'metadata.json 缺少组件版本。' }

$runtimeBuild = Join-Path $PSScriptRoot 'build-widget-runtime.mjs'
node $runtimeBuild
if ($LASTEXITCODE -ne 0) { throw '无法生成 Sapphire 兼容运行时。' }

$outputPath = Join-Path $distRoot ('netease-lyrics-glass-v{0}.sawidget' -f $version)
$tempPath = Join-Path $distRoot ('netease-lyrics-glass-v{0}.tmp.zip' -f $version)

$requiredFiles = @(
    'metadata.json',
    'index.html',
    'styles.css',
    'app.js',
    'app.runtime.js',
    'sapphire-smtc.js',
    'settings.js',
    'lyric-view-model.js',
    'preview-mode.js',
    'responsive-layout.js',
    'playback-state.js',
    'preview.png',
    'assets/icon.svg'
)

foreach ($relativePath in $requiredFiles) {
    $absolutePath = Join-Path $widgetRoot $relativePath
    if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
        throw "组件缺少必需文件：$relativePath"
    }
}

$resolvedRepoRoot = [IO.Path]::GetFullPath($repoRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$resolvedOutputPath = [IO.Path]::GetFullPath($outputPath)
if (-not $resolvedOutputPath.StartsWith($resolvedRepoRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw '打包输出路径不在仓库目录内。'
}

if (-not (Test-Path -LiteralPath $distRoot -PathType Container)) {
    New-Item -ItemType Directory -Path $distRoot | Out-Null
}
if (Test-Path -LiteralPath $tempPath) { [IO.File]::Delete($tempPath) }
if (Test-Path -LiteralPath $outputPath) { [IO.File]::Delete($outputPath) }

Compress-Archive -Path (Join-Path $widgetRoot '*') -DestinationPath $tempPath -CompressionLevel Optimal
[IO.File]::Move($tempPath, $outputPath)
Write-Output "已生成：$outputPath"
