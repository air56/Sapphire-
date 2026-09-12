# Sapphire-网易云双语歌词小组件

为 Sapphire 制作的网易云音乐双语歌词小组件。组件会自动识别当前播放歌曲，显示原文歌词、中文翻译和下一句歌词，并提供可调节的字号、显示长度、文字颜色以及自由宽高布局。

> 当前组件版本：**0.1.14**
> 组件包类型：Sapphire HTML Widget
> 运行平台：Windows 10/11

## 功能特性

- **自动识别当前歌曲**：优先读取 Sapphire 提供的 SMTC/WebChannel 媒体信息；Bridge 不可用或 WebChannel 不可用时，回退到 Windows 系统媒体会话。
- **网易云歌词匹配**：根据歌曲标题、歌手和专辑信息查询公开歌词数据，并使用匹配评分避免显示其他歌曲的歌词。
- **双语歌词**：外文原文显示在上方，网易云提供的中文翻译显示在下方；双语歌词使用固定高度槽位，翻译出现或消失时不会推动下一句位置跳动。
- **播放同步**：按照时间戳逐行切换当前歌词，并持续同步播放进度；支持 SSE 推送和定时快照轮询兜底。
- **纯透明视觉**：正式组件不绘制卡片底色、亚克力背景、边框或环境光，歌词直接悬浮在桌面背景上，仅保留轻微文字阴影以提升可读性。
- **自由调整尺寸**：在 Sapphire 编辑模式中可以分别拖动组件的宽度和高度，不锁定为方形；横向空间充足时显示为歌词条，空间较窄时自动适配。
- **外观设置**：可调节歌词字号、最大显示长度和文字颜色，设置会保存到本地浏览器存储。

## 安装要求

使用正式组件前，请准备：

1. Windows 10 或 Windows 11。
2. 已安装并运行支持 HTML 小组件和 SMTC 的 Sapphire 版本。
3. 网易云音乐 Windows 桌面客户端（浏览器网页播放器不能提供本项目所需的系统媒体会话）。
4. 如果从源码运行 Bridge，需要安装 **.NET 8 SDK 或更高版本**，并确保 dotnet 命令可用。

检查 .NET SDK：

~~~powershell
dotnet --version
~~~

## 安装与使用

### 1. 获取项目

克隆仓库或下载代码后，在仓库根目录打开 PowerShell：

~~~powershell
git clone https://github.com/air56/Sapphire-.git
cd Sapphire-
~~~

如果你使用的是 Codex 的开发工作树，请在当前工作树目录执行后续命令，不要混用其他旧工作树里的脚本。

### 2. 构建并启动歌词 Bridge

先构建解决方案：

~~~powershell
dotnet build .\NeteaseLyrics.sln
~~~

手动启动 Bridge：

~~~powershell
.\scripts\run-bridge.ps1
~~~

Bridge 只监听本机地址 http://127.0.0.1:18763。启动后打开以下地址，如果看到 Netease Lyrics Bridge is running.，说明服务已经开始监听：

http://127.0.0.1:18763/

### 3. 设置 Bridge 登录自启（推荐）

每次开机登录后自动启动 Bridge，只需在仓库根目录用当前 Windows 用户运行一次：

~~~powershell
.\scripts\install-bridge-autostart.ps1
~~~

该脚本会创建名为 NeteaseLyricsBridge 的用户级任务，使用隐藏窗口启动 Bridge，不需要管理员权限。任务使用当前仓库路径，因此如果仓库目录发生移动，请在新目录重新运行安装脚本。

Bridge 的启动日志位于：

- %LocalAppData%\NeteaseLyricsBridge\bridge.stdout.log
- %LocalAppData%\NeteaseLyricsBridge\bridge.stderr.log

取消登录自启：

~~~powershell
.\scripts\uninstall-bridge-autostart.ps1
~~~

### 4. 打包并导入 Sapphire

在仓库根目录运行：

~~~powershell
.\scripts\package-widget.ps1
~~~

脚本会读取 widgets/netease-lyrics-glass/metadata.json 的版本号并生成对应的 .sawidget 安装包，例如：

dist/netease-lyrics-glass-v0.1.14.sawidget

然后在 Sapphire 的小组件管理器中导入该文件并添加到桌面。升级组件时建议先删除桌面上的旧实例，再导入新包并重新添加，避免 Sapphire 复用旧的 WebEngine 缓存或旧实例设置。

### 5. 播放并调整歌词

1. 启动网易云音乐 Windows 桌面客户端。
2. 播放一首歌曲，等待约 1–3 秒让系统媒体信息更新。
3. 添加或刷新“网易云双语歌词玻璃条”组件。
4. 点击右上角齿轮，调整字号、最大显示长度和文字颜色。
5. 在 Sapphire 编辑模式中分别拖动组件的左右边缘和上下边缘，调整宽度与高度。

组件不需要填写歌曲 ID，也不需要在网易云音乐中开启开发者选项。外文歌曲有翻译时，中文翻译会固定显示在原文下方；组件会自动隐藏没有翻译的翻译行并维持歌词槽位高度。

## 工作原理

歌词服务由组件和本机 Bridge 两部分组成：

1. **媒体信息读取**：组件优先订阅 Sapphire WebChannel 的 SMTC 属性和变化信号，读取歌曲标题、歌手、专辑、播放状态、播放位置和时长。
2. **本机兜底**：Bridge 监听 Windows 系统媒体传输控件（SMTC）会话，识别网易云音乐桌面客户端并提供当前媒体快照。
3. **歌词查询**：Bridge 根据媒体元数据请求网易云公开歌词接口，解析原文与翻译并缓存匹配结果。
4. **同步传输**：组件通过本机 SSE /v1/events 接收实时快照；当 SSE 不可用时，定时轮询 /v1/snapshot。

Bridge 的 HTTP 接口只绑定回环地址 127.0.0.1，不会监听局域网。常用健康检查接口：

~~~text
GET http://127.0.0.1:18763/
GET http://127.0.0.1:18763/v1/snapshot
GET http://127.0.0.1:18763/v1/events
~~~

## 故障排查

### 组件显示“尚未连接歌词服务”

- 确认 Bridge 已启动，访问 http://127.0.0.1:18763/ 检查是否返回运行提示。
- 如果刚设置了自启，可以在“任务计划程序”中找到 NeteaseLyricsBridge 并手动运行一次。
- 检查日志：%LocalAppData%\NeteaseLyricsBridge\bridge.stderr.log。
- 确认没有其他程序占用端口 18763。

### 显示“打开网易云并播放歌曲”

- 必须使用网易云音乐 Windows 桌面客户端，网页播放器通常不会提供可用的 Windows SMTC 会话。
- 确认歌曲处于播放或暂停状态，并等待几秒让系统媒体信息刷新。
- 如果 Sapphire 使用旧实例，删除旧组件后重新导入最新的 .sawidget 包。

### 能检测到歌曲但没有歌词

- 检查歌曲标题和歌手是否完整，部分纯音乐、现场版或重名歌曲可能无法可靠匹配。
- 检查网络连接；Bridge 需要访问网易云公开歌词接口。
- 查看 lyrics-cache.json 是否生成：%LocalAppData%\NeteaseLyricsBridge\lyrics-cache.json。
- Bridge 查询失败时不要反复重启 Sapphire；服务恢复后组件会自动重连和重试。

### 开机后仍未自动启动

- 确认已经在当前仓库目录运行过 install-bridge-autostart.ps1。
- 如果仓库移动过位置，重新运行安装脚本更新任务路径。
- 在任务计划程序中检查任务 NeteaseLyricsBridge 的“上次运行结果”。
- 确认 .NET 8 SDK 或运行环境可用；详细错误可查看 Bridge 日志文件。

## 隐私与声明

- 组件与 Bridge 的通信仅使用本机回环地址 127.0.0.1:18763，不会主动监听局域网或公网。
- 本项目不读取网易云音乐账户密码、Cookie、私有进程内存，也不上传账户信息或完整播放历史。
- Bridge 只读取当前 Windows 媒体会话所需的歌曲元数据，并请求公开歌词数据；歌词缓存保存在本机 %LocalAppData%\NeteaseLyricsBridge\。
- 本项目是社区个人开发项目，**未与网易云音乐官方建立合作、授权或隶属关系**；“网易云音乐”及相关商标归其各自权利人所有。
- **歌词版权归原词作者、音乐发行方及其他相关权利人所有**。本项目只提供个人本地显示和技术演示能力，不主张或转让歌词版权，不建议将抓取的歌词用于商业分发、公开再发布或绕过平台限制。
- 网络接口、歌曲匹配和歌词可用性受第三方服务变化影响，作者不保证所有歌曲、翻译或播放状态始终可用。
- 仓库当前未附带独立的 LICENSE 文件。除非另有明确书面授权，请不要将仓库代码视为可无限制复制、修改或再发布。

## 开发与测试

源码结构：

- widgets/netease-lyrics-glass/：Sapphire HTML 小组件、样式、歌词视图模型和预览页。
- src/NeteaseLyricsBridge/：.NET 8 本机歌词 Bridge。
- scripts/：运行、打包和登录自启脚本。
- docs/user-guide.md：更详细的使用与故障排查说明。

运行前端测试：

~~~powershell
node --test widgets/netease-lyrics-glass/tests/*.test.mjs
~~~

运行 Bridge 测试：

~~~powershell
dotnet test .\NeteaseLyrics.sln --no-restore
~~~

构建组件安装包：

~~~powershell
.\scripts\package-widget.ps1
~~~

生成的 .sawidget 包被 .gitignore 排除，不会自动提交到 Git；请从本地 dist 目录导入使用。

## 当前限制

- 目前支持 Windows 10/11 与网易云音乐 Windows 桌面客户端。
- 歌词按时间戳逐行同步，不支持网易云 KRC 的逐字高亮动画。
- 不支持网易云以外播放器的歌词识别。
- 没有可靠匹配结果时会显示无歌词状态，不会冒险显示其他歌曲的歌词。
