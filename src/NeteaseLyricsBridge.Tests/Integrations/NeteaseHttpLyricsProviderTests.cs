using System.Net;
using System.Text;
using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Core;
using NeteaseLyricsBridge.Integrations;

namespace NeteaseLyricsBridge.Tests.Integrations;

public sealed class NeteaseHttpLyricsProviderTests
{
    [Fact]
    public async Task GetLyricsAsync_SearchesThenFetchesAndMergesTranslatedLyrics()
    {
        var requests = new List<CapturedRequest>();
        using var client = new HttpClient(new StubHttpMessageHandler(async request =>
        {
            requests.Add(await CapturedRequest.CreateAsync(request));

            return request.RequestUri!.AbsolutePath.Contains("search", StringComparison.Ordinal)
                ? Json("""
                    {"result":{"songs":[{"id":7,"name":"The Bells","artists":[{"name":"Alice"},{"name":"Zed"}],"duration":180000}]}}
                    """)
                : Json("""
                    {"lrc":{"lyric":"[00:01.50]hello"},"tlyric":{"lyric":"[00:01.50]旧翻译"},"ytlrc":{"lyric":"[00:01.50]新翻译"}}
                    """);
        }))
        {
            BaseAddress = new Uri("https://music.163.com/")
        };
        var provider = new NeteaseHttpLyricsProvider(client, new SongMatchScorer());
        var identity = TrackIdentity.Create("The Bells", ["Alice", "Zed"], 180_000);

        var result = await provider.GetLyricsAsync(identity, CancellationToken.None);

        Assert.Equal("ready", result.Status);
        Assert.Null(result.ErrorCode);
        Assert.Equal("新翻译", result.Lines.Single(line => line.StartMs == 1500).Translation);
        Assert.Collection(requests,
            search =>
            {
                Assert.Equal(HttpMethod.Post, search.Method);
                Assert.Contains("the+bells", search.Body, StringComparison.Ordinal);
                Assert.Equal("https://music.163.com/", search.Referrer);
                Assert.False(string.IsNullOrWhiteSpace(search.UserAgent));
            },
            lyric =>
            {
                Assert.Equal(HttpMethod.Get, lyric.Method);
                Assert.Equal("/api/song/lyric", lyric.Uri.AbsolutePath);
                 Assert.Contains("id=7", lyric.Uri.Query, StringComparison.Ordinal);
                 Assert.Contains("lv=1", lyric.Uri.Query, StringComparison.Ordinal);
                 Assert.Contains("tv=-1", lyric.Uri.Query, StringComparison.Ordinal);
                 Assert.Contains("kv=1", lyric.Uri.Query, StringComparison.Ordinal);
                 Assert.DoesNotContain("ytv=", lyric.Uri.Query, StringComparison.Ordinal);
            });
    }

    [Fact]
    public async Task GetLyricsAsync_ReturnsReadyCachedLyricsWithoutSendingHttpRequests()
    {
        var requestCount = 0;
        var cached = new LyricsLookupResult("ready", [new LyricLine(1_500, "hello", "你好")], null);
        var cache = new StubBridgeCache(cached);
        using var client = new HttpClient(new StubHttpMessageHandler(_ =>
        {
            requestCount++;
            return Task.FromException<HttpResponseMessage>(new InvalidOperationException("The cache hit must not use HTTP."));
        }))
        {
            BaseAddress = new Uri("https://music.163.com/")
        };
        var provider = new NeteaseHttpLyricsProvider(client, new SongMatchScorer(), cache);

        var result = await provider.GetLyricsAsync(
            TrackIdentity.Create("The Bells", ["Alice"], 180_000),
            CancellationToken.None);

        Assert.Equal(cached, result);
        Assert.Equal(1, cache.GetCount);
        Assert.Equal(0, cache.SetCount);
        Assert.Equal(0, requestCount);
    }

    [Fact]
    public async Task GetLyricsAsync_CachesReadyLyricsAfterFetchingThem()
    {
        var cache = new StubBridgeCache(null);
        using var client = new HttpClient(new StubHttpMessageHandler(request =>
            Task.FromResult(request.RequestUri!.AbsolutePath.Contains("search", StringComparison.Ordinal)
                ? Json("""
                    {"result":{"songs":[{"id":7,"name":"The Bells","artists":[{"name":"Alice"}],"duration":180000}]}}
                    """)
                : Json("""
                    {"lrc":{"lyric":"[00:01.50]hello"},"tlyric":{"lyric":"[00:01.50]旧翻译"},"ytlrc":{"lyric":"[00:01.50]新翻译"}}
                    """))))
        {
            BaseAddress = new Uri("https://music.163.com/")
        };
        var provider = new NeteaseHttpLyricsProvider(client, new SongMatchScorer(), cache);
        var identity = TrackIdentity.Create("The Bells", ["Alice"], 180_000);

        var result = await provider.GetLyricsAsync(identity, CancellationToken.None);

        Assert.Equal("ready", result.Status);
        Assert.Equal(1, cache.GetCount);
        Assert.Equal(1, cache.SetCount);
        Assert.Equal(result, cache.StoredResult);
    }

    [Fact]
    public async Task GetLyricsAsync_ReturnsUnavailableWithoutAConfidentSearchMatch()
    {
        var requestCount = 0;
        using var client = new HttpClient(new StubHttpMessageHandler(_ =>
        {
            requestCount++;
            return Task.FromResult(Json("""
                {"result":{"songs":[{"id":7,"name":"Different","artists":[{"name":"Other"}],"duration":180000}]}}
                """));
        }))
        {
            BaseAddress = new Uri("https://music.163.com/")
        };
        var provider = new NeteaseHttpLyricsProvider(client, new SongMatchScorer());

        var result = await provider.GetLyricsAsync(
            TrackIdentity.Create("The Bells", ["Alice"], 180_000),
            CancellationToken.None);

        Assert.Equal("unavailable", result.Status);
        Assert.Empty(result.Lines);
        Assert.Equal(1, requestCount);
    }

    [Fact]
    public async Task GetLyricsAsync_ReturnsErrorForANonSuccessResponse()
    {
        using var client = new HttpClient(new StubHttpMessageHandler(_ =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable))))
        {
            BaseAddress = new Uri("https://music.163.com/")
        };
        var provider = new NeteaseHttpLyricsProvider(client, new SongMatchScorer());

        var result = await provider.GetLyricsAsync(
            TrackIdentity.Create("The Bells", ["Alice"], 180_000),
            CancellationToken.None);

        Assert.Equal("error", result.Status);
        Assert.NotNull(result.ErrorCode);
    }

    private static HttpResponseMessage Json(string body) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(body, Encoding.UTF8, "application/json")
    };

    private sealed class StubBridgeCache(LyricsLookupResult? cached) : IBridgeCache
    {
        public int GetCount { get; private set; }

        public int SetCount { get; private set; }

        public LyricsLookupResult? StoredResult { get; private set; }

        public Task<LyricsLookupResult?> GetAsync(TrackIdentity identity, CancellationToken cancellationToken)
        {
            GetCount++;
            return Task.FromResult(cached);
        }

        public Task SetAsync(TrackIdentity identity, LyricsLookupResult result, CancellationToken cancellationToken)
        {
            SetCount++;
            StoredResult = result;
            return Task.CompletedTask;
        }
    }

    private sealed class StubHttpMessageHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> responder)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            responder(request);
    }

    private sealed record CapturedRequest(
        HttpMethod Method,
        Uri Uri,
        string Body,
        string? Referrer,
        string UserAgent)
    {
        public static async Task<CapturedRequest> CreateAsync(HttpRequestMessage request) => new(
            request.Method,
            request.RequestUri!,
            request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(),
            request.Headers.Referrer?.ToString(),
            request.Headers.UserAgent.ToString());
    }
}
