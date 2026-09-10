# 网易云双语歌词 SWidget 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 Windows 10/11 上交付一个可自由调整尺寸、以 Liquid Glass 风格显示网易云当前曲目双语逐行歌词的 Sapphire SWidget，以及一个仅监听 `127.0.0.1` 的本机 Bridge。

**架构：** `NeteaseLyricsBridge` 是 .NET 8 的本机进程：它适配 Windows SMTC、通过网易云歌词 HTTP 端点检索并缓存 LRC、规范化成桥接状态，并以 HTTP 快照和 SSE 事件提供给小组件。`netease-lyrics-glass` 是 HTML SWidget：通过 `SWebWidget.qml` 载入，使用 `EventSource` 消费 Bridge；纯函数视图模型负责进度定位和响应式内容选择，DOM/CSS 负责 Liquid Glass 呈现和设置交互。

**技术栈：** .NET 8 (`net8.0-windows10.0.19041.0`)、C#、Windows `GlobalSystemMediaTransportControlsSessionManager`、ASP.NET Core Minimal API、SSE、xUnit、Node 内置 `node:test`、原生 HTML/CSS/JavaScript、SWidget `SWebWidget.qml`。

---

## 0. 实现前置条件和约束

- 工作树必须基于提交 `68449fa` 或其后继提交，并在实现前创建隔离 worktree。
- 不修改 Sapphire 宿主源码；SWidget 通过标准 `.sawidget` 包安装。
- Bridge 的监听地址固定为 `http://127.0.0.1:18763`。不支持 `0.0.0.0`、IPv6 监听或任意端口覆盖。
- Bridge 只接受网易云的 SMTC 会话：`SourceAppUserModelId` 转为小写后必须包含 `netease` 或 `cloudmusic`。
- 搜索结果匹配分数为：标题相似度 `0.65`、艺人相似度 `0.25`、时长相似度 `0.10`。仅当最高分不少于 `0.78` 且比第二名至少高 `0.08` 时使用结果；其余情况返回 `unavailable`，不能显示低置信度歌词。
- 歌词缓存文件保存在 `%LocalAppData%\NeteaseLyricsBridge\lyrics-cache.json`；缓存键是小写归一化的 `title|artists|durationMs`，有效期为 30 天，最多保存 500 条记录，按最近访问时间淘汰。
- 远端歌词请求由 Bridge 完成。搜索使用 `POST /api/search/get/web?csrf_token=`，歌词使用 `GET /api/song/lyric?os=pc&id={songId}&lv=-1&kv=-1&tv=-1`，HTTP 客户端必须发送 `Referer: https://music.163.com/`、桌面浏览器 `User-Agent`，并接受 JSON 响应内的 `lrc.lyric` 与 `tlyric.lyric` 字段。
- SWidget 的持久化设置使用浏览器 `localStorage`，键为 `neteaseLyricsGlass.settings.v1`；Bridge 不保存小组件设置和完整播放历史。

## 1. 目标文件结构

```text
src/
  NeteaseLyricsBridge/
    NeteaseLyricsBridge.csproj                 # 可执行 Bridge 项目与依赖声明
    Program.cs                                  # Host、回环监听、DI、HTTP/SSE 路由
    appsettings.json                            # 日志、缓存路径和远端 API 基址
    Contracts/
      BridgeSnapshot.cs                         # 对外 JSON 状态契约
      LyricLine.cs                              # 时间戳歌词行契约
      PlaybackState.cs                          # 播放状态枚举
    Core/
      TrackIdentity.cs                          # 歌曲归一化与缓存键
      LrcParser.cs                              # 原文/翻译 LRC 解析器
      LyricTimeline.cs                          # 当前句和下一句定位
      SongMatchScorer.cs                        # 网易云搜索结果置信度计算
      TrackSessionCoordinator.cs                # 切歌版本、状态原子切换和迟到响应保护
    Integrations/
      ISmtcSessionFeed.cs                       # 可测试的 SMTC 抽象
      WindowsSmtcSessionFeed.cs                 # Windows SMTC 实现
      ILyricsProvider.cs                        # 远端歌词来源抽象
      NeteaseHttpLyricsProvider.cs              # 搜索、评分、歌词 HTTP 请求
      IBridgeCache.cs                           # 缓存抽象
      JsonFileBridgeCache.cs                    # 原子 JSON 缓存实现
    Hosting/
      BridgeStateStore.cs                       # 当前快照和版本化发布
      SseClientRegistry.cs                      # SSE 客户端订阅、广播、取消
      BridgeBackgroundService.cs                # SMTC 事件到协调器的生命周期服务
  NeteaseLyricsBridge.Tests/
    NeteaseLyricsBridge.Tests.csproj
    Core/
      LrcParserTests.cs
      LyricTimelineTests.cs
      SongMatchScorerTests.cs
      TrackSessionCoordinatorTests.cs
    Integrations/
      NeteaseHttpLyricsProviderTests.cs
      JsonFileBridgeCacheTests.cs
    Hosting/
      BridgeHttpContractTests.cs

widgets/
  netease-lyrics-glass/
    metadata.json                               # SWidget 元数据、网络/编辑事件权限
    SWebWidget.qml                              # HTML 容器与浏览器环境注入
    index.html                                  # 无构建入口
    styles.css                                  # Liquid Glass、响应式与状态样式
    app.js                                      # 启动、SSE、DOM 绑定、设置面板
    lyric-view-model.js                         # 纯函数歌词显示模型
    settings.js                                 # localStorage schema、校验、读写
    assets/
      icon.svg                                  # 小组件图标
    tests/
      lyric-view-model.test.mjs
      settings.test.mjs
    package.json                                # `node --test` 脚本

scripts/
  package-widget.ps1                            # 验证文件后生成 .sawidget
  run-bridge.ps1                                # 本地开发运行 Bridge

docs/
  superpowers/
    specs/2026-09-10-netease-lyrics-swidget-design.md
    plans/2026-09-10-netease-lyrics-swidget.md
  user-guide.md                                 # 安装、运行、故障排除、隐私边界
```

## 2. 任务 1：初始化解决方案、协议类型和测试基线

**文件：**
- 创建：`src/NeteaseLyricsBridge/NeteaseLyricsBridge.csproj`
- 创建：`src/NeteaseLyricsBridge/Contracts/PlaybackState.cs`
- 创建：`src/NeteaseLyricsBridge/Contracts/LyricLine.cs`
- 创建：`src/NeteaseLyricsBridge/Contracts/BridgeSnapshot.cs`
- 创建：`src/NeteaseLyricsBridge/Core/TrackIdentity.cs`
- 创建：`src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj`
- 创建：`src/NeteaseLyricsBridge.Tests/Core/TrackIdentityTests.cs`
- 创建：`NeteaseLyrics.sln`

- [ ] **步骤 1：创建 .NET 解决方案与测试项目。**

运行：

```powershell
dotnet new sln --name NeteaseLyrics
dotnet new web --name NeteaseLyricsBridge --output src/NeteaseLyricsBridge --framework net8.0
dotnet new xunit --name NeteaseLyricsBridge.Tests --output src/NeteaseLyricsBridge.Tests --framework net8.0
dotnet sln NeteaseLyrics.sln add src/NeteaseLyricsBridge/NeteaseLyricsBridge.csproj src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj
dotnet add src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj reference src/NeteaseLyricsBridge/NeteaseLyricsBridge.csproj
dotnet add src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj package Microsoft.AspNetCore.Mvc.Testing --version 8.0.30
```

随后将两个项目的目标框架改为 `net8.0-windows10.0.19041.0`。该 TFM 会启用 C#/WinRT 的 Windows SDK 投影，因此不添加旧的 `Microsoft.Windows.SDK.Contracts` 包；C# 可直接使用 `Windows.Media.Control` API，并保持 Windows 10 基线兼容。

- [ ] **步骤 2：编写失败的歌曲身份归一化测试。**

在 `TrackIdentityTests.cs` 写入：

```csharp
using NeteaseLyricsBridge.Core;

namespace NeteaseLyricsBridge.Tests.Core;

public sealed class TrackIdentityTests
{
    [Fact]
    public void CacheKey_NormalizesCaseWhitespaceAndArtistOrder()
    {
        var identity = TrackIdentity.Create(
            title: "  The   Bells ",
            artists: ["Zed", " Alice "],
            durationMs: 180_020);

        Assert.Equal("the bells|alice,zed|180020", identity.CacheKey);
    }
}
```

- [ ] **步骤 3：运行测试，确认其因类型尚不存在而失败。**

运行：

```powershell
dotnet test src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj --filter FullyQualifiedName~TrackIdentityTests
```

预期：编译失败，指出 `TrackIdentity` 未定义。

- [ ] **步骤 4：实现最小契约和身份类型。**

实现 `public sealed record TrackIdentity(string Title, IReadOnlyList<string> Artists, long DurationMs)`；它公开只读 `CacheKey` 属性和 `static TrackIdentity Create(string title, IReadOnlyList<string> artists, long durationMs)`。`Create` 的固定规则是：去除首尾空白、连续空白压缩为一个空格、使用 `ToLowerInvariant()`、艺人去重排序、以 `,` 串接；时长使用原始整数毫秒。创建以下对外数据契约：

```csharp
public enum PlaybackState { Playing, Paused, Stopped }
public sealed record LyricLine(long StartMs, string Original, string? Translation);
public sealed record TrackDto(string Title, IReadOnlyList<string> Artists, string? Album, string? Artwork, long DurationMs);
public sealed record PlaybackDto(PlaybackState State, long PositionMs, DateTimeOffset UpdatedAt);
public sealed record LyricsDto(string Status, IReadOnlyList<LyricLine> Lines);
public sealed record BridgeDto(string Status, string? ErrorCode);
public sealed record BridgeSnapshot(string TrackSessionId, TrackDto? Track, PlaybackDto Playback, LyricsDto Lyrics, BridgeDto Bridge);
```

- [ ] **步骤 5：重新运行定向测试并提交。**

运行：

```powershell
dotnet test src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj --filter FullyQualifiedName~TrackIdentityTests
```

预期：`Passed: 1`。

提交：

```powershell
git add NeteaseLyrics.sln src/NeteaseLyricsBridge src/NeteaseLyricsBridge.Tests
git commit -m "chore: 初始化歌词桥接解决方案"
```

## 3. 任务 2：以 TDD 实现 LRC 解析、翻译合并和当前句定位

**文件：**
- 创建：`src/NeteaseLyricsBridge/Core/LrcParser.cs`
- 创建：`src/NeteaseLyricsBridge/Core/LyricTimeline.cs`
- 创建：`src/NeteaseLyricsBridge.Tests/Core/LrcParserTests.cs`
- 创建：`src/NeteaseLyricsBridge.Tests/Core/LyricTimelineTests.cs`

- [ ] **步骤 1：为多时间戳、翻译和无效行写失败测试。**

```csharp
[Fact]
public void ParseAndMerge_ExpandsTimestampsAndAttachesTranslationByTime()
{
    const string original = "[00:01.50][00:03.00]hello\n[00:05.00]world\n[ar:artist]";
    const string translation = "[00:01.50]你好\n[00:05.00]世界";

    var lines = LrcParser.ParseAndMerge(original, translation);

    Assert.Collection(lines,
        line => Assert.Equal(new LyricLine(1500, "hello", "你好"), line),
        line => Assert.Equal(new LyricLine(3000, "hello", null), line),
        line => Assert.Equal(new LyricLine(5000, "world", "世界"), line));
}

[Fact]
public void Select_ReturnsCurrentAndNextAtBoundary()
{
    var lines = new[]
    {
        new LyricLine(1000, "one", null),
        new LyricLine(2000, "two", "二"),
        new LyricLine(3000, "three", null)
    };

    var selection = LyricTimeline.Select(lines, 2000);

    Assert.Equal("two", selection.Current?.Original);
    Assert.Equal("three", selection.Next?.Original);
}
```

- [ ] **步骤 2：运行测试，确认失败。**

运行：

```powershell
dotnet test src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj --filter "FullyQualifiedName~LrcParserTests|FullyQualifiedName~LyricTimelineTests"
```

预期：编译失败，指出 `LrcParser` 和 `LyricTimeline` 未定义。

- [ ] **步骤 3：实现最小解析和选择逻辑。**

`LrcParser.ParseAndMerge(string original, string? translation)` 必须：

```csharp
// 时间标签格式：mm:ss、mm:ss.d、mm:ss.dd 或 mm:ss.ddd。
// 每一原文时间标签展开为独立 LyricLine；空文本和 [ar:] 等元数据行跳过。
// 翻译通过完全相同的 startMs 关联；同一时间戳的翻译以最后一个非空文本为准。
// 返回按 StartMs 升序稳定排序的只读列表。
```

`LyricTimeline.Select` 返回 `record LyricSelection(LyricLine? Current, LyricLine? Next)`；位置在第一行之前时 `Current=null`、`Next=第一行`；位置超过最后一行时 `Current=最后一行`、`Next=null`。

- [ ] **步骤 4：运行解析和时间轴测试。**

运行：

```powershell
dotnet test src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj --filter "FullyQualifiedName~LrcParserTests|FullyQualifiedName~LyricTimelineTests"
```

预期：所有上述测试通过。

- [ ] **步骤 5：补充无翻译、首句前、末句后和空歌词测试并运行完整 Bridge 测试。**

```powershell
dotnet test src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj
```

预期：所有测试通过，无失败。

- [ ] **步骤 6：提交。**

```powershell
git add src/NeteaseLyricsBridge/Core src/NeteaseLyricsBridge.Tests/Core
git commit -m "feat: 解析并定位双语 LRC 歌词"
```

## 4. 任务 3：实现网易云检索、严格匹配和文件缓存

**文件：**
- 创建：`src/NeteaseLyricsBridge/Core/SongMatchScorer.cs`
- 创建：`src/NeteaseLyricsBridge/Integrations/ILyricsProvider.cs`
- 创建：`src/NeteaseLyricsBridge/Integrations/NeteaseHttpLyricsProvider.cs`
- 创建：`src/NeteaseLyricsBridge/Integrations/IBridgeCache.cs`
- 创建：`src/NeteaseLyricsBridge/Integrations/JsonFileBridgeCache.cs`
- 创建：`src/NeteaseLyricsBridge.Tests/Core/SongMatchScorerTests.cs`
- 创建：`src/NeteaseLyricsBridge.Tests/Integrations/NeteaseHttpLyricsProviderTests.cs`
- 创建：`src/NeteaseLyricsBridge.Tests/Integrations/JsonFileBridgeCacheTests.cs`

- [ ] **步骤 1：写失败的匹配分数与拒绝歧义结果测试。**

```csharp
[Fact]
public void PickBest_RejectsCandidateBelowConfidenceThreshold()
{
    var query = TrackIdentity.Create("a song", ["artist"], 180_000);
    var candidates = new[] { new SongCandidate(1, "another song", ["other"], 180_000) };

    Assert.Null(new SongMatchScorer().PickBest(query, candidates));
}

[Fact]
public void PickBest_RejectsTieCloserThanPointZeroEight()
{
    var query = TrackIdentity.Create("hello", ["artist"], 180_000);
    var candidates = new[]
    {
        new SongCandidate(1, "hello", ["artist"], 180_000),
        new SongCandidate(2, "hello", ["artist"], 180_100)
    };

    Assert.Null(new SongMatchScorer().PickBest(query, candidates));
}
```

- [ ] **步骤 2：运行定向测试，确认失败。**

运行：

```powershell
dotnet test src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj --filter FullyQualifiedName~SongMatchScorerTests
```

预期：编译失败，指出 `SongCandidate` 和 `SongMatchScorer` 未定义。

- [ ] **步骤 3：实现严格匹配评分。**

实现 `SongCandidate` 与 `SongMatchScorer.PickBest`：标题和艺人相似度使用归一化 token 的 Jaccard 系数；时长分数是 `max(0, 1 - abs(deltaMs)/5000d)`；总分使用计划开头规定的权重；排序后应用 `0.78` 与 `0.08` 双阈值。

- [ ] **步骤 4：为 HTTP 提供者写失败测试。**

使用继承 `HttpMessageHandler` 的 `StubHttpMessageHandler` 验证：搜索请求是 POST，包含检索标题，歌词请求包含胜出 `songId`，并将 `lrc.lyric` 和 `tlyric.lyric` 交给 `LrcParser`。

```csharp
var provider = new NeteaseHttpLyricsProvider(httpClient, new SongMatchScorer());
var result = await provider.GetLyricsAsync(identity, CancellationToken.None);

Assert.Equal("ready", result.Status);
Assert.Equal("你好", result.Lines.Single(line => line.StartMs == 1500).Translation);
```

- [ ] **步骤 5：实现提供者与缓存。**

`ILyricsProvider.GetLyricsAsync(TrackIdentity, CancellationToken)` 返回 `LyricsLookupResult(string Status, IReadOnlyList<LyricLine> Lines, string? ErrorCode)`。`NeteaseHttpLyricsProvider` 必须在 10 秒超时内完成搜索、严格匹配和歌词查询；`HttpRequestException` 与非成功 HTTP 状态返回 `error`；没有合格歌曲或歌词文本为空返回 `unavailable`。

`JsonFileBridgeCache` 必须在临时文件写入成功后使用 `File.Move(temp, target, overwrite: true)` 原子替换；加载损坏 JSON 时删除损坏文件并返回空缓存；写入时执行 30 天过期清除和 500 项 LRU 淘汰。

- [ ] **步骤 6：运行提供者、缓存及完整 Bridge 测试。**

运行：

```powershell
dotnet test src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj
```

预期：所有测试通过；测试不访问真实网络。

- [ ] **步骤 7：提交。**

```powershell
git add src/NeteaseLyricsBridge/Core src/NeteaseLyricsBridge/Integrations src/NeteaseLyricsBridge.Tests
git commit -m "feat: 添加网易云歌词检索与本地缓存"
```

## 5. 任务 4：适配 Windows SMTC，并保证切歌不串歌词

**文件：**
- 创建：`src/NeteaseLyricsBridge/Integrations/ISmtcSessionFeed.cs`
- 创建：`src/NeteaseLyricsBridge/Integrations/WindowsSmtcSessionFeed.cs`
- 创建：`src/NeteaseLyricsBridge/Core/TrackSessionCoordinator.cs`
- 创建：`src/NeteaseLyricsBridge.Tests/Core/TrackSessionCoordinatorTests.cs`

- [ ] **步骤 1：写失败的会话切换与迟到响应测试。**

```csharp
[Fact]
public async Task SwitchTrack_DiscardsLateLyricsFromPreviousSession()
{
    var provider = new ControllableLyricsProvider();
    var coordinator = new TrackSessionCoordinator(provider);

    await coordinator.ApplyMediaAsync(MediaUpdate.Playing("song A", ["artist"], 180_000, 1_000));
    await coordinator.ApplyMediaAsync(MediaUpdate.Playing("song B", ["artist"], 200_000, 2_000));
    provider.CompleteFirstRequestWith("song A lyric");

    var snapshot = coordinator.Current;
    Assert.Equal("song B", snapshot.Track!.Title);
    Assert.NotEqual("song A lyric", snapshot.Lyrics.Lines.FirstOrDefault()?.Original);
}
```

- [ ] **步骤 2：运行测试，确认失败。**

运行：

```powershell
dotnet test src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj --filter FullyQualifiedName~TrackSessionCoordinatorTests
```

预期：编译失败，指出 `TrackSessionCoordinator` 未定义。

- [ ] **步骤 3：实现协调器。**

协调器在曲目身份变化时递增不可复用的 `trackSessionId`，立即发布 `LyricsDto("loading", [])`，并启动带该会话标识的可取消歌词任务。完成任务前必须比对任务的会话标识与当前会话；不匹配则直接丢弃。播放位置和状态变化只能更新当前会话的 `PlaybackDto`，不得再次触发歌词查询。

`ISmtcSessionFeed.cs` 定义 `public sealed record MediaUpdate(string? SourceAppUserModelId, string? Title, IReadOnlyList<string> Artists, string? Album, string? Artwork, long DurationMs, PlaybackState State, long PositionMs, DateTimeOffset UpdatedAt)` 和 `Task StartAsync(Func<MediaUpdate, Task> onUpdate, CancellationToken)`. `WindowsSmtcSessionFeed` 使用 `GlobalSystemMediaTransportControlsSessionManager.RequestAsync()` 订阅会话、媒体属性和时间轴事件，只将 `SourceAppUserModelId` 符合前置约束的会话转成 `MediaUpdate`。

- [ ] **步骤 4：在真实 Windows API 之外完成单元测试。**

`TrackSessionCoordinatorTests` 使用内存提供者和手动 `MediaUpdate`，不得要求已安装网易云。新增断言：暂停不触发歌词查询；拖动更新 position；没有匹配会话时快照的 `bridge.status` 是 `waitingForPlayer`。

运行：

```powershell
dotnet test src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj
```

预期：所有测试通过。

- [ ] **步骤 5：提交。**

```powershell
git add src/NeteaseLyricsBridge/Integrations src/NeteaseLyricsBridge/Core src/NeteaseLyricsBridge.Tests/Core
git commit -m "feat: 订阅网易云 SMTC 并隔离切歌会话"
```

## 6. 任务 5：暴露仅回环 HTTP 快照和 SSE 事件流

**文件：**
- 创建：`src/NeteaseLyricsBridge/Hosting/BridgeStateStore.cs`
- 创建：`src/NeteaseLyricsBridge/Hosting/SseClientRegistry.cs`
- 创建：`src/NeteaseLyricsBridge/Hosting/BridgeBackgroundService.cs`
- 修改：`src/NeteaseLyricsBridge/Program.cs`
- 创建：`src/NeteaseLyricsBridge.Tests/Hosting/BridgeHttpContractTests.cs`
- 创建：`src/NeteaseLyricsBridge/appsettings.json`

- [ ] **步骤 1：写失败的 HTTP 契约测试。**

```csharp
[Fact]
public async Task SnapshotEndpoint_ReturnsTheCurrentBridgeSnapshot()
{
    await using var factory = new BridgeWebApplicationFactory();
    var client = factory.CreateClient();

    var response = await client.GetAsync("/v1/snapshot");
    var json = await response.Content.ReadAsStringAsync();

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Contains("trackSessionId", json, StringComparison.Ordinal);
}

[Fact]
public async Task EventsEndpoint_UsesEventStreamContentType()
{
    await using var factory = new BridgeWebApplicationFactory();
    using var response = await factory.CreateClient().GetAsync("/v1/events", HttpCompletionOption.ResponseHeadersRead);

    Assert.Equal("text/event-stream", response.Content.Headers.ContentType!.MediaType);
}
```

- [ ] **步骤 2：运行 HTTP 测试，确认失败。**

运行：

```powershell
dotnet test src/NeteaseLyricsBridge.Tests/NeteaseLyricsBridge.Tests.csproj --filter FullyQualifiedName~BridgeHttpContractTests
```

预期：测试失败，因为路由尚未实现。

- [ ] **步骤 3：实现状态存储和 SSE 广播。**

`BridgeHttpContractTests.cs` 内定义 `sealed class BridgeWebApplicationFactory : WebApplicationFactory<Program>`，并通过测试 DI 注册内存 `ISmtcSessionFeed` 和 `ILyricsProvider`。`BridgeStateStore` 用 `lock` 保护当前快照，每次版本变化调用 `SseClientRegistry.BroadcastAsync(snapshot)`。SSE 响应必须：

```text
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
event: snapshot
data: {完整 BridgeSnapshot JSON}

```

`/v1/snapshot` 始终返回当前完整快照；`/v1/events` 连接后先发送一次完整快照，再订阅增量完整快照；客户端断开通过 `RequestAborted` 取消订阅。`Program.cs` 只能使用 `http://127.0.0.1:18763` 启动 Kestrel，并拒绝 Host 不是 `127.0.0.1:18763` 的配置。

- [ ] **步骤 4：注册后台服务与强制回环监听。**

`BridgeBackgroundService` 在应用启动时创建 `WindowsSmtcSessionFeed`，把更新送到 `TrackSessionCoordinator`，并将每次协调器快照发布到 `BridgeStateStore`。任何初始化异常都产生 `bridge.status="error"` 和稳定错误码，进程保持运行以便自动恢复。

- [ ] **步骤 5：运行所有 Bridge 测试并手动检查回环绑定。**

运行：

```powershell
dotnet test NeteaseLyrics.sln
dotnet run --project src/NeteaseLyricsBridge
Get-NetTCPConnection -LocalPort 18763 | Select-Object LocalAddress,LocalPort,State
```

预期：测试全部通过；端口 `18763` 只出现 `127.0.0.1` 的监听项。停止手动进程后再继续。

- [ ] **步骤 6：提交。**

```powershell
git add src/NeteaseLyricsBridge src/NeteaseLyricsBridge.Tests/Hosting
git commit -m "feat: 提供本机歌词快照与 SSE 接口"
```

## 7. 任务 6：创建可安装的 SWidget 外壳和可测试设置模块

**文件：**
- 创建：`widgets/netease-lyrics-glass/metadata.json`
- 创建：`widgets/netease-lyrics-glass/SWebWidget.qml`
- 创建：`widgets/netease-lyrics-glass/index.html`
- 创建：`widgets/netease-lyrics-glass/app.js`
- 创建：`widgets/netease-lyrics-glass/settings.js`
- 创建：`widgets/netease-lyrics-glass/package.json`
- 创建：`widgets/netease-lyrics-glass/tests/settings.test.mjs`
- 创建：`widgets/netease-lyrics-glass/assets/icon.svg`

- [ ] **步骤 1：建立 Node 测试脚本和失败的设置测试。**

`package.json` 必须只包含原生测试命令：

```json
{
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
```

在 `settings.test.mjs` 写入：

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings } from '../settings.js';

test('normalizeSettings clamps and preserves supported user preferences', () => {
  assert.deepEqual(normalizeSettings({ fontSize: 99, maxChars: 9, color: '#123456' }), {
    fontSize: 48,
    maxChars: 20,
    color: '#123456'
  });
});
```

- [ ] **步骤 2：运行测试，确认模块缺失。**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests/settings.test.mjs
```

预期：失败，指出 `settings.js` 不存在或没有导出 `normalizeSettings`。

- [ ] **步骤 3：实现固定设置 schema。**

`settings.js` 导出以下值和函数：

```javascript
export const SETTINGS_KEY = 'neteaseLyricsGlass.settings.v1';
export const DEFAULT_SETTINGS = Object.freeze({ fontSize: 26, maxChars: 56, color: '#F7FBFF' });

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function normalizeColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : DEFAULT_SETTINGS.color;
}

export function normalizeSettings(input = {}) {
  return {
    fontSize: clampInteger(input.fontSize, 16, 48, DEFAULT_SETTINGS.fontSize),
    maxChars: clampInteger(input.maxChars, 20, 180, DEFAULT_SETTINGS.maxChars),
    color: normalizeColor(input.color)
  };
}

export function loadSettings(storage = localStorage) {
  try { return normalizeSettings(JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}')); }
  catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(next, storage = localStorage) {
  const normalized = normalizeSettings(next);
  storage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}
```

- [ ] **步骤 4：实现 SWidget 元数据和容器。**

`metadata.json` 必须使用 `widgetType: "Html"`、默认尺寸 `width: 640` 与 `height: 128`、`network: true`、`mouseEventMode: "OnlyNonEdit"`，并将入口指向 `SWebWidget.qml`。`SWebWidget.qml` 必须载入同目录 `index.html`，传入 `width`、`height`、`appPath` 和 `theme`，并把编辑模式同步到网页，以便网页在编辑状态下禁用设置按钮的指针操作，让 Sapphire 可以拖拽调整组件。

- [ ] **步骤 5：实现最小 HTML 启动壳。**

`index.html` 只引用 `styles.css` 和模块脚本 `app.js`，并提供以下稳定 DOM ID：`widget-root`、`state-label`、`current-original`、`current-translation`、`next-original`、`settings-toggle`、`settings-panel`、`font-size-input`、`max-chars-input`、`color-input`。初始状态必须是“等待歌词桥接服务”。

- [ ] **步骤 6：重新运行 Node 设置测试并提交。**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests/settings.test.mjs
```

预期：`pass 1`、`fail 0`。

提交：

```powershell
git add widgets/netease-lyrics-glass
git commit -m "feat: 创建歌词玻璃小组件外壳与本地设置"
```

## 8. 任务 7：实现小组件的歌词视图模型、进度补间和 SSE 重连

**文件：**
- 创建：`widgets/netease-lyrics-glass/lyric-view-model.js`
- 创建：`widgets/netease-lyrics-glass/tests/lyric-view-model.test.mjs`
- 修改：`widgets/netease-lyrics-glass/app.js`

- [ ] **步骤 1：写失败的纯函数视图模型测试。**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectDisplayLines } from '../lyric-view-model.js';

test('selectDisplayLines shows translation only when the current line has one', () => {
  const result = selectDisplayLines([
    { startMs: 1000, original: 'one', translation: null },
    { startMs: 2000, original: 'two', translation: '二' }
  ], 2000, 56);

  assert.deepEqual(result, {
    currentOriginal: 'two',
    currentTranslation: '二',
    nextOriginal: null
  });
});

test('selectDisplayLines truncates without splitting surrogate pairs', () => {
  const result = selectDisplayLines([{ startMs: 0, original: 'A😀BC', translation: null }], 0, 3);
  assert.equal(result.currentOriginal, 'A😀…');
});
```

- [ ] **步骤 2：运行测试，确认失败。**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests/lyric-view-model.test.mjs
```

预期：失败，指出 `lyric-view-model.js` 或其导出不存在。

- [ ] **步骤 3：实现歌词选择与安全截断。**

`selectDisplayLines(lines, positionMs, maxChars)` 选择最后一个 `startMs <= positionMs` 的有效原文作为当前句，并获取其后的第一个有效原文作为预告。没有当前行时显示空当前句和第一句预告；没有下一句时 `nextOriginal=null`。截断必须使用 `Array.from(text)`，在超过 `maxChars` 时保留 `maxChars - 1` 个 Unicode code point 并加 `…`。

- [ ] **步骤 4：实现 `app.js` 的状态机。**

定义 `bridgeSnapshot`、`lastPositionAnchor` 与 `reconnectAttempt`。逻辑固定如下：

```javascript
// `playing`：positionMs + (performance.now() - anchor.monotonicMs)，每 100ms 刷新一次显示。
// `paused`/`stopped`：使用快照 positionMs，不启动补间。
// SSE 收到不同 trackSessionId：立即清空歌词 DOM，渲染 loading；仅在新会话 ready 时填充新行。
// EventSource onerror：关闭旧实例；在 1s、2s、4s、8s、16s、30s 后重连，最大 30s。
// 首次与每次重连前 GET /v1/snapshot；网络失败时状态为“等待歌词桥接服务”。
```

`renderSnapshot` 必须把 Bridge 状态映射为固定中文文本：`waitingForPlayer → “打开网易云并播放歌曲”`、`loading → “正在获取歌词”`、`unavailable → “当前歌曲暂无可用歌词”`、`error → “歌词暂时不可用”`、SSE 不可达 → “等待歌词桥接服务”。

- [ ] **步骤 5：运行全部小组件逻辑测试。**

运行：

```powershell
npm --prefix widgets/netease-lyrics-glass test
```

预期：所有 Node 测试通过，且不需要 Sapphire 或 Bridge 运行。

- [ ] **步骤 6：提交。**

```powershell
git add widgets/netease-lyrics-glass/app.js widgets/netease-lyrics-glass/lyric-view-model.js widgets/netease-lyrics-glass/tests
git commit -m "feat: 同步显示双语歌词并自动重连桥接"
```

## 9. 任务 8：实现 Liquid Glass 视觉、任意尺寸响应式布局和设置交互

**文件：**
- 创建：`widgets/netease-lyrics-glass/styles.css`
- 修改：`widgets/netease-lyrics-glass/index.html`
- 修改：`widgets/netease-lyrics-glass/app.js`
- 修改：`widgets/netease-lyrics-glass/tests/settings.test.mjs`

- [ ] **步骤 1：为设置写失败测试。**

新增 `saveSettings` 测试，验证写入后 `fontSize`、`maxChars`、`color` 仍符合限制，并验证非法颜色 `"red"` 回退到 `#F7FBFF`。

- [ ] **步骤 2：运行设置测试，确认失败。**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests/settings.test.mjs
```

预期：新测试失败，因为存储读写尚未覆盖非法颜色回退路径。

- [ ] **步骤 3：完成设置面板的事件绑定和样式变量更新。**

`app.js` 在每次用户调整输入时调用 `saveSettings`，并把规范化设置写入根元素：

```javascript
root.style.setProperty('--lyric-size', `${settings.fontSize}px`);
root.style.setProperty('--lyric-color', settings.color);
root.style.setProperty('--translation-size', `${Math.round(settings.fontSize * 0.62)}px`);
root.style.setProperty('--preview-size', `${Math.round(settings.fontSize * 0.56)}px`);
```

设置面板通过齿轮按钮切换；页面收到 `editing=true` 时关闭面板并为按钮设置 `disabled=true`。`ResizeObserver` 将根元素写入 `data-layout="wide" | "stacked" | "compact"`：可用宽度至少 560px 为 `wide`；低于 560px 为 `stacked`；高度低于 105px 为 `compact`。

- [ ] **步骤 4：实现完整 CSS。**

`styles.css` 必须以如下原则实现，而不是依赖图片：

```css
:root { --lyric-size: 26px; --lyric-color: #F7FBFF; --translation-size: 16px; --preview-size: 15px; }
#widget-root {
  box-sizing: border-box; min-height: 100vh; overflow: hidden; color: var(--lyric-color);
  background: radial-gradient(circle at 10% 15%, rgb(122 205 255 / .42), transparent 35%),
              radial-gradient(circle at 85% 80%, rgb(209 125 255 / .34), transparent 38%),
              rgb(20 32 72 / .38);
  border: 1px solid rgb(255 255 255 / .48); border-radius: 22px;
  backdrop-filter: blur(28px) saturate(145%);
  box-shadow: inset 0 1px 1px rgb(255 255 255 / .72), 0 16px 38px rgb(4 11 36 / .34);
}
#current-original { font-size: var(--lyric-size); color: var(--lyric-color); font-weight: 700; }
#current-translation { font-size: var(--translation-size); color: color-mix(in srgb, var(--lyric-color) 76%, transparent); }
#next-original { font-size: var(--preview-size); color: color-mix(in srgb, var(--lyric-color) 38%, transparent); }
[data-layout='wide'] .lyrics { display: flex; align-items: baseline; gap: 14px; white-space: nowrap; }
[data-layout='stacked'] .lyrics { display: grid; gap: 6px; white-space: normal; }
[data-layout='compact'] #next-original { display: none; }
[data-layout='wide'] .lyric-text { overflow: hidden; text-overflow: ellipsis; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
```

必须为 `prefers-reduced-motion: reduce` 关闭环境光浮动与歌词过渡，且不使用无限高 CPU 占用动画。

- [ ] **步骤 5：运行 Node 测试，并进行浏览器尺寸人工检查。**

运行：

```powershell
npm --prefix widgets/netease-lyrics-glass test
```

预期：全部通过。

在 Sapphire 预览中分别设置 `640×128`、`360×180`、`260×82`，逐项确认：宽歌词条不呈方形；窄尺寸显示垂直原文/翻译；紧凑高度隐藏预告；长原文不越出边框；字号、长度与颜色刷新后保留。

- [ ] **步骤 6：提交。**

```powershell
git add widgets/netease-lyrics-glass
git commit -m "feat: 添加自适应 Liquid Glass 歌词界面"
```

## 10. 任务 9：打包、用户文档和端到端验收

**文件：**
- 创建：`scripts/package-widget.ps1`
- 创建：`scripts/run-bridge.ps1`
- 创建：`docs/user-guide.md`
- 创建：`dist/.gitkeep`
- 修改：`.gitignore`

- [ ] **步骤 1：写失败的打包前置检查。**

在 PowerShell 脚本顶部，若下列任一文件缺失则抛出明确错误并停止：`metadata.json`、`SWebWidget.qml`、`index.html`、`styles.css`、`app.js`、`settings.js`、`lyric-view-model.js`、`assets/icon.svg`。目标输出固定为 `dist/netease-lyrics-glass.sawidget`。

运行：

```powershell
Remove-Item -LiteralPath widgets/netease-lyrics-glass/assets/icon.svg
.\scripts\package-widget.ps1
```

预期：失败，错误文本包含缺失的 `assets/icon.svg`。测试后用 `git checkout -- widgets/netease-lyrics-glass/assets/icon.svg` 还原。

- [ ] **步骤 2：实现安全打包脚本。**

`package-widget.ps1` 必须先验证文件清单，再删除同名旧输出，最后用 `Compress-Archive` 把 `widgets/netease-lyrics-glass` 的内容打入临时 ZIP 并重命名为 `.sawidget`。脚本不使用递归删除，不接受外部路径参数。

- [ ] **步骤 3：实现开发运行脚本。**

`run-bridge.ps1` 运行：

```powershell
dotnet run --project "$PSScriptRoot\..\src\NeteaseLyricsBridge\NeteaseLyricsBridge.csproj"
```

脚本在运行前检查 `dotnet --version` 的主版本为 8 或更高，并在不满足时输出“需要 .NET 8 SDK 或更高版本”。

- [ ] **步骤 4：编写用户指南。**

`docs/user-guide.md` 必须包含：

1. 安装 .NET 8、构建并启动 Bridge；
2. 在 Sapphire 导入 `dist/netease-lyrics-glass.sawidget`；
3. 启动网易云音乐桌面客户端并播放歌曲；
4. 通过齿轮调整字号、最大显示长度和文字颜色，以及在 Sapphire 编辑模式拖拽宽高；
5. “等待歌词桥接服务”“打开网易云并播放歌曲”“当前歌曲暂无可用歌词”的含义和处理方法；
6. Bridge 仅在 `127.0.0.1:18763` 通信、歌词缓存路径、不会上传账户信息或完整播放历史；
7. 首期不支持逐字 KRC、网易云以外播放器和无法可靠匹配的歌曲。

- [ ] **步骤 5：运行自动验证与打包。**

运行：

```powershell
dotnet test NeteaseLyrics.sln
npm --prefix widgets/netease-lyrics-glass test
.\scripts\package-widget.ps1
Test-Path .\dist\netease-lyrics-glass.sawidget
```

预期：.NET 测试通过、Node 测试通过、打包脚本成功、最后命令输出 `True`。

- [ ] **步骤 6：进行 Windows 实机验收。**

在 Windows 10 与 Windows 11 各执行一次：启动 Bridge、打开网易云、播放具有中文翻译的歌曲；验证自动识别、原文+翻译、下一句预告、暂停、拖动、切歌和 Bridge 重启恢复。然后分别验证无翻译歌曲、无歌词歌曲、Bridge 未启动和网络暂时不可用时的状态。将每个平台的结果写入 `docs/user-guide.md` 的“实机验证记录”表，记录日期、系统版本、网易云客户端版本、Bridge 版本和通过项。

- [ ] **步骤 7：提交。**

```powershell
git add .gitignore scripts docs/user-guide.md dist/.gitkeep
git commit -m "docs: 添加歌词组件安装与验收指南"
```

## 11. 最终验证清单

执行者必须在宣布完成前运行并记录以下命令的完整结果：

```powershell
git status --short
git diff --check
dotnet test NeteaseLyrics.sln
npm --prefix widgets/netease-lyrics-glass test
.\scripts\package-widget.ps1
Test-Path .\dist\netease-lyrics-glass.sawidget
```

验收条件：工作树无未预期变更；`git diff --check` 没有输出；.NET 与 Node 测试全部通过；`.sawidget` 文件存在；两套 Windows 实机验收记录均已写入用户指南。
