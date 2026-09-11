# Sapphire WebChannel 优先歌词识别设计规格

**日期：** 2026-09-11  
**状态：** 用户已选择方案 A，待实现  
**关联组件：** `netease-lyrics-glass`、`NeteaseLyricsBridge`

## 1. 目标

在保留现有 Windows SMTC 本机 Bridge 兜底能力的前提下，优先读取 Sapphire HTML 小组件提供的原生 WebChannel SMTC 数据。这样组件能直接获取 Sapphire 当前媒体会话的歌曲、歌手、专辑、播放状态、进度与时长；Bridge 只负责网易云歌词检索、翻译合并、缓存和向 UI 推送歌词状态。

## 2. 数据流与优先级

```text
Sapphire WebChannel（主路径）
  qrc:///qtwebchannel/qwebchannel.js
  → bridge.smtcMediaInfo / bridge.smtcPlaybackStatus
  → 仅在 appName 属于网易云时发送本地 POST /v1/smtc
  → TrackSessionCoordinator
  → 网易云候选歌曲匹配 / 歌词缓存 / lrc + ytlrc + tlyric 合并
  → /v1/snapshot + /v1/events
  → 小组件渲染原文、中文翻译与下一句

Windows SMTC Bridge（兜底路径）
  → WindowsSmtcSessionFeed
  → TrackSessionCoordinator
```

- WebChannel 不能初始化、字段缺失、当前会话不是网易云或 POST 失败时，UI 不显示调试信息，并继续从本机 Bridge SSE 读取状态。
- 本机 Bridge 保持 `127.0.0.1:18763` 监听；小组件不访问第三方镜像、也不存储网易云登录凭据。
- 仅将 `appName` 含 `netease`、`cloudmusic` 或 `网易云` 的 WebChannel 更新送入 Bridge。非网易云播放器不会清空正在由 Windows SMTC 兜底提供的网易云歌词。
- 现有 Windows SMTC 事件与 WebChannel 推送都经同一个 `TrackSessionCoordinator` 去重：同一首歌只查询一次歌词，进度/暂停/拖动只更新播放状态。

## 3. Sapphire WebChannel 契约

参照 Sapphire 的官方 `example_webchannel`：

1. 在 HTML 中加载 `qrc:///qtwebchannel/qwebchannel.js`。
2. 使用 `new QWebChannel(qt.webChannelTransport, callback)` 获取 `channel.objects.bridge`。
3. 初始读取 JSON 字符串属性 `bridge.smtcMediaInfo`、`bridge.smtcPlaybackStatus`。
4. 订阅 `smtcMediaInfoChanged`、`smtcPlaybackStatusChanged`，每次事件重新读取属性。
5. 从媒体 JSON 提取 `enabled`、`mediaTitle`、`mediaArtist`、`mediaAlbum`、`appName`；从播放 JSON 提取 `enabled`、`playbackStatus`、`playbackPosition`、`playbackDuration`。

字段解析必须容错：不是 JSON、非数值进度、缺标题、未启用 SMTC、未知播放状态都不得令小组件崩溃，也不得把无效数据发给本机服务。

## 4. Bridge 本地输入契约

新增仅本机 POST 路由 `/v1/smtc`，接收经过前端标准化的媒体更新：

```json
{
  "sourceAppUserModelId": "网易云音乐",
  "title": "歌曲名",
  "artists": ["歌手"],
  "album": "专辑名",
  "durationMs": 201000,
  "state": "Playing",
  "positionMs": 42000,
  "updatedAt": "2026-09-11T03:00:00.000Z"
}
```

服务端仍通过 `MediaUpdate.IsNeteaseSession` 进行第二次过滤。`Artwork` 始终为 `null`，避免发送和缓存不必要的封面 Base64 数据。

## 5. 歌词来源与翻译

Bridge 继续通过网易云网页接口匹配并读取歌词：

- 搜索：根据标准化的歌名、歌手、时长取得候选曲目，保留原有置信度门槛。
- 歌词：优先请求新版 `/api/song/lyric/v1`，同时携带 `lv`、`tv`、`yv`、`ytv` 等版本参数。
- 合并顺序：`lrc.lyric` 为原文；先使用 `ytlrc.lyric`，没有再回退 `tlyric.lyric` 作为逐行翻译；逐字 `yrc.lyric` 留给后续逐字高亮，不改变本期逐行 UI。
- 检索成功的逐行结果按既有 30 天、500 条上限的本地缓存保存。

## 6. 测试和验收

必须先写失败测试并观察失败：

- WebChannel JSON → Bridge 更新的字段、网易云名称过滤、非法 JSON 与缺字段处理；
- WebChannel 媒体与播放信息合并、暂停与进度换算；
- `/v1/smtc` 会将合法网易云更新交给协调器，非网易云更新不覆盖状态；
- 识别到 `ytlrc` 时优先显示其翻译，缺失时回退 `tlyric`；
- WebChannel 不可用时仍保留原 Bridge SSE 连接路径；
- 运行 .NET、前端测试、组件打包，并用启动的 Bridge 检查 `/v1/snapshot`。

## 7. 参考实现与许可证边界

仅参考公开接口使用方式、字段语义与架构思路，不复制第三方源代码：

- Sapphire 官方 WebChannel 示例：`hymnly133/swidget/example_webchannel`，用于 QWebChannel 初始化、SMTC 属性和变更信号。
- ivLyrics 网易云插件：`1-Dot/ivlyrics-netease-cloud-music`，用于其公开说明的网易云搜索、翻译歌词合并和官方 Web API 路径。
- NeteaseCloudMusicApi：`Binaryify/NeteaseCloudMusicApi`，仅用于核对歌词端点版本参数与响应字段；不会作为运行时依赖或嵌入其代码。

网易云网页接口并非稳定公开 SDK，可能受到地区、频率或服务端变更影响。因此应把失败状态清晰降级为“歌词暂时不可用”，同时优先使用本地缓存。
