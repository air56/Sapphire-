# Sapphire WebChannel 优先歌词识别实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 优先通过 Sapphire WebChannel 读取网易云当前媒体信息，同时保留 Windows SMTC Bridge 兜底，并支持网易云双语歌词检索与显示。

**架构：** 前端新增独立的 WebChannel 适配器，将 Sapphire 的两个 JSON 响应式属性合并成经过网易云过滤的本地媒体更新，通过仅回环的 POST 提交给 Bridge。Bridge 新增输入路由，继续使用现有协调器、缓存、SSE 与 Windows SMTC fallback。歌词提供器升级为新版歌词接口并按 `ytlrc → tlyric` 顺序合并翻译。

**技术栈：** 原生 ES Modules、QWebChannel、Node `node:test`、.NET 8 Minimal API、xUnit、Windows SMTC。

---

## 文件结构

- `widgets/netease-lyrics-glass/sapphire-smtc.js`：无 DOM 的 WebChannel 解析和生命周期适配器。
- `widgets/netease-lyrics-glass/app.js`：启动适配器，并将可信网易云更新 POST 到 Bridge。
- `widgets/netease-lyrics-glass/index.html`：提供 QWebChannel 的 Qt 资源脚本。
- `widgets/netease-lyrics-glass/tests/sapphire-smtc.test.mjs`：前端解析、过滤和反应式更新测试。
- `src/NeteaseLyricsBridge/Contracts/SapphireSmtcUpdate.cs`：本机 WebChannel 输入 DTO 与安全转换。
- `src/NeteaseLyricsBridge/Program.cs`：增加 `/v1/smtc` 回环 POST 路由。
- `src/NeteaseLyricsBridge/Integrations/NeteaseHttpLyricsProvider.cs`：升级新版歌词请求和翻译优先级。
- `src/NeteaseLyricsBridge.Tests/Contracts/SapphireSmtcUpdateTests.cs`：输入转换与过滤测试。
- `src/NeteaseLyricsBridge.Tests/Integrations/NeteaseHttpLyricsProviderTests.cs`：新版歌词接口、`ytlrc` 优先级测试。
- `docs/user-guide.md`：写明组件安装、Bridge 启动及自动识别的无需额外配置条件。

## 任务 1：前端 WebChannel 数据适配器（TDD）

- [ ] 编写 `sapphire-smtc.test.mjs`：有效的 `网易云音乐` 媒体+播放 JSON 产生 `{ sourceAppUserModelId, title, artists, album, durationMs, positionMs, state }`；`Spotify`、非法 JSON、`enabled:false`、空标题返回 `null`。
- [ ] 运行 `node --test widgets/netease-lyrics-glass/tests/sapphire-smtc.test.mjs`，确认因模块不存在而失败。
- [ ] 创建 `sapphire-smtc.js`：导出 `createSapphireSmtcUpdate(mediaJson, playbackJson, now)`、`isNeteaseApplicationName`、`startSapphireSmtc(onUpdate, runtime)`；在 `start` 中读取初始属性并订阅两个 changed 信号。
- [ ] 重跑同一测试，确认通过。
- [ ] Commit：`feat: add Sapphire SMTC adapter`。

## 任务 2：组件与本机 Bridge 的 WebChannel 输入链路（TDD）

- [ ] 在前端测试中增加模拟 QWebChannel transport 的用例：初始读取和任一 changed 信号都会将合并后的网易云更新交给回调；缺少 Qt runtime 时仅返回 `{ connected:false }`。
- [ ] 运行该测试，确认 `startSapphireSmtc` 未满足期望而失败。
- [ ] 在 `index.html` 加载 Qt WebChannel 脚本；在 `app.js` 中调用适配器，并用 `fetch(POST /v1/smtc)` 提交更新；网络失败只保留开发者控制台信息，歌词 UI 继续通过 SSE 降级。
- [ ] 在 `SapphireSmtcUpdateTests.cs` 中写入合法网易云 DTO、非网易云 DTO、负时长/负进度和缺标题测试，并运行 `dotnet test --filter FullyQualifiedName~SapphireSmtcUpdateTests`，确认失败。
- [ ] 创建 `SapphireSmtcUpdate.cs`，实现限制数值、标准化数组和 `TryToMediaUpdate(out MediaUpdate)`；修改 `Program.cs` 增加 `/v1/smtc`，只把 `TryToMediaUpdate` 成功的输入交给 `TrackSessionCoordinator`。
- [ ] 重跑前端和 .NET 定向测试，确认通过。
- [ ] Commit：`feat: forward Sapphire SMTC updates to bridge`。

## 任务 3：新版歌词接口与翻译选择（TDD）

- [ ] 在 `NeteaseHttpLyricsProviderTests.cs` 增加断言：歌词请求路径为 `/api/song/lyric/v1`，查询包含 `id`、`lv`、`tv`、`yv`、`ytv`；同时有 `ytlrc` 和 `tlyric` 时显示 `ytlrc`，仅 `tlyric` 时正确回退。
- [ ] 运行 `dotnet test --filter FullyQualifiedName~NeteaseHttpLyricsProviderTests`，确认请求路径或翻译期望失败。
- [ ] 修改 `NeteaseHttpLyricsProvider.cs` 使用新版端点并读取 `ytlrc.lyric ?? tlyric.lyric`，保持现有超时、缓存与错误处理。
- [ ] 重跑该测试，确认通过。
- [ ] Commit：`feat: prefer newer NetEase translated lyrics`。

## 任务 4：用户说明、完整验证和打包

- [ ] 更新 `docs/user-guide.md`：导入新的 `.sawidget`、启动 `run-bridge.ps1`、打开网易云并播放歌曲即可；无需在网易云内开启额外开发者选项；解释 Bridge 退出或接口限制时的中文状态提示。
- [ ] 运行 `dotnet test NeteaseLyrics.sln`，预期所有 .NET 测试通过。
- [ ] 运行 `npm --prefix widgets/netease-lyrics-glass test`，预期所有前端测试通过。
- [ ] 运行 `./scripts/package-widget.ps1` 和 `git diff --check`，预期打包生成 `dist/n​etease-lyrics-glass.sawidget` 且无空白错误。
- [ ] 可用时启动 `./scripts/run-bridge.ps1` 并请求 `http://127.0.0.1:18763/v1/snapshot`，确认返回 JSON 快照。
- [ ] Commit：`docs: explain Sapphire lyric recognition setup`。

## 自检

- 规格覆盖：WebChannel 主路径、SMTC 兜底、网易云过滤、歌词翻译优先级、测试、用户操作均有对应任务。
- 无占位符：所有新类型、函数、路由、测试文件和验证命令在任务中明确给出。
- 类型一致：前端使用 `sourceAppUserModelId/title/artists/album/durationMs/state/positionMs/updatedAt`；后端 DTO 使用相同 JSON 属性，并转换为既有 `MediaUpdate`。
