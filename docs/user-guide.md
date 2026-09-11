# 网易云双语歌词玻璃小组件使用指南

## 目前状态

本项目已完成小组件外壳、Liquid Glass 响应式界面、设置持久化、歌词视图模型、SSE 重连逻辑，以及 .NET 8 本机 Bridge 的实现。当前版本新增 Sapphire WebChannel SMTC 主路径：组件会优先读取 Sapphire 提供的当前媒体信息，并在本机 Bridge 中完成网易云歌词匹配；Windows SMTC 仍作为兜底路径。实机播放验证需要在 Windows 10/11 上安装网易云音乐桌面客户端后进行。

## 更新旧版本（0.1.4）

本次 `0.1.4` 为安装包和页面资源增加了版本标识，避免 Sapphire 继续复用旧组件包或 WebEngine 缓存；网易云歌词接口和歌曲匹配修复已包含在此前版本中。请删除旧组件后重新导入带版本号的新包。

如果你已经导入过早期的 `0.1.0` 安装包，请先在 Sapphire 的小组件管理器中删除旧的“网易云双语歌词玻璃条”，再导入本版本生成的安装包。早期版本把 QML 容器错误地作为 HTML 主文件，可能导致歌词区显示源代码、样式异常或组件无法运行。

## 安装与启动

### 1. 安装 .NET 8 SDK

在 Windows 上安装 .NET 8 SDK 或更高版本，并在 PowerShell 中确认：

```powershell
dotnet --version
```

### 2. 构建并启动 Bridge

在仓库根目录运行：

```powershell
dotnet build NeteaseLyrics.sln
dotnet run --project .\src\NeteaseLyricsBridge\NeteaseLyricsBridge.csproj
```

也可以直接运行：

```powershell
.\scripts\run-bridge.ps1
```

`run-bridge.ps1` 已使用 Windows PowerShell 5.1 兼容的 UTF-8 BOM 编码。如果脚本提示“字符串缺少终止符”，请确认运行的是当前工作树中的脚本，不要从聊天窗口复制脚本内容覆盖它。

Bridge 只监听本机 `127.0.0.1:18763`，不会监听局域网地址。启动后可用浏览器访问本机根路径确认服务已启动。

### 3. 打包并导入 Sapphire

```powershell
.\scripts\package-widget.ps1
```

生成的文件为 `dist/netease-lyrics-glass-v0.1.4.sawidget`。本次修复后的组件版本为 `0.1.4`。在 Sapphire 的小组件导入界面选择这个文件，然后将组件添加到桌面。

### 4. 播放歌曲

如果组件显示“打开网易云并播放歌曲”，按下面顺序检查：

1. 确认运行的是网易云音乐 Windows 桌面客户端，而不是浏览器网页播放器。
2. 确认 `run-bridge.ps1` 的 PowerShell 窗口仍在运行；不要关闭它。
3. 在网易云中真正开始播放一首歌曲，等待约 1–3 秒让 Sapphire 的 SMTC 信息完成更新。
4. 在浏览器或 Sapphire 内打开 `http://127.0.0.1:18763/`，看到 `Netease Lyrics Bridge is running.` 才表示 Bridge 正在监听。
5. 如果之前导入过旧包，请先删除旧的“网易云双语歌词玻璃条”，再导入新生成的 `.sawidget`；旧包可能把 `SWebWidget.qml` 当成 HTML 入口，从而在歌词栏显示源代码。

组件不需要额外手动配置 WebChannel。新包的 `index.html` 会加载 Sapphire 提供的 `qrc:///qtwebchannel/qwebchannel.js`，然后订阅 `bridge.smtcMediaInfo`、`bridge.smtcPlaybackStatus` 及其变化信号。WebChannel 不可用时，组件仍会连接 `127.0.0.1:18763` 的 SSE 兜底链路。

打开网易云音乐 Windows 桌面客户端并播放歌曲。组件会自动通过 Sapphire WebChannel 读取当前 SMTC 媒体信息；识别失败时会自动回退到本机 Windows SMTC Bridge。匹配歌曲后显示原文歌词；网易云提供翻译时，会在原文下显示中文翻译，并显示下一句预告。无需在网易云内开启额外开发者选项，也无需填写歌曲 ID。

## 调整外观

- 点击组件右上角齿轮：调整歌词字号、最大显示长度和文字颜色；设置会自动保存到浏览器本地存储。
- 在 Sapphire 编辑模式中拖动组件边缘：宽度和高度可以自由调整，不锁定为方形。
- 宽度较大时组件采用横向歌词条布局；宽度变窄时自动切为纵向布局；高度不足时隐藏下一句，优先保留当前歌词。
- 组件使用半透明亚克力、背景模糊、细描边、内高光和阴影，形成 Liquid Glass 的立体效果。

## 状态提示说明

| 提示 | 含义与处理 |
| --- | --- |
| 尚未连接歌词服务 | Bridge 尚未启动、已退出或暂时断线。启动 Bridge 后组件会自动重连。 |
| 打开网易云并播放歌曲 | 没有检测到网易云桌面客户端的可用播放会话。打开网易云并播放一首歌。 |
| 正在获取歌词 | 已识别歌曲，正在从网易云查询歌词；网络恢复后会自动继续。 |
| 当前歌曲暂无可用歌词 | 当前歌曲没有可用的可靠歌词，或搜索匹配置信度不足。 |
| 歌词暂时不可用 | 查询过程发生临时错误。可以等待重试，或检查网络连接。 |

## 隐私、缓存与通信

- 组件与 Bridge 的通信只使用本机回环地址 `127.0.0.1:18763`。
- 歌词缓存位于 `%LocalAppData%\NeteaseLyricsBridge\lyrics-cache.json`，缓存有效期为 30 天，最多保存 500 条。
- Bridge 不上传网易云账户信息，也不保存完整播放历史；它只读取 Windows 媒体会话中当前歌曲的必要元数据，并查询公开歌词接口。
- 不读取网易云私有进程内存或内部缓存。

## 首期限制

- 只支持 Windows 10/11 与网易云音乐桌面客户端。
- 当前版本按时间戳逐行显示歌词，不支持逐字 KRC 动画。
- 不支持网易云以外的播放器。
- 无法可靠匹配到歌曲时不会显示可能属于其他歌曲的歌词。

## 实机验证记录

截至 2026 年 9 月 11 日，尚未在本开发环境中完成 Windows 10/Windows 11 + 网易云客户端的实机播放验收。发布前请按下表补充结果：

| 日期 | Windows 版本 | 网易云客户端版本 | Bridge 版本 | 结果 |
| --- | --- | --- | --- | --- |
| 待补充 | Windows 10 | 待补充 | 0.1.4 | 待验证 |
| 待补充 | Windows 11 | 待补充 | 0.1.4 | 待验证 |
