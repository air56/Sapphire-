using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Core;
using NeteaseLyricsBridge.Integrations;

namespace NeteaseLyricsBridge.Tests.Integrations;

public sealed class JsonFileBridgeCacheTests
{
    [Fact]
    public async Task SetAsync_PersistsAndReturnsLyricsForTheSameTrack()
    {
        using var sandbox = new CacheSandbox();
        var identity = TrackIdentity.Create("The Bells", ["Alice"], 180_000);
        var expected = new LyricsLookupResult("ready", [new LyricLine(1500, "hello", "你好")], null);

        var writer = new JsonFileBridgeCache(sandbox.FilePath);
        await writer.SetAsync(identity, expected, CancellationToken.None);

        var reader = new JsonFileBridgeCache(sandbox.FilePath);
        var actual = await reader.GetAsync(identity, CancellationToken.None);

        Assert.NotNull(actual);
        Assert.Equal(expected.Status, actual!.Status);
        Assert.Equal(expected.ErrorCode, actual.ErrorCode);
        Assert.Equal(expected.Lines, actual.Lines);
    }

    [Fact]
    public async Task GetAsync_DeletesCorruptedCacheAndReturnsNoEntry()
    {
        using var sandbox = new CacheSandbox();
        await File.WriteAllTextAsync(sandbox.FilePath, "this is not json");
        var cache = new JsonFileBridgeCache(sandbox.FilePath);

        var result = await cache.GetAsync(
            TrackIdentity.Create("The Bells", ["Alice"], 180_000),
            CancellationToken.None);

        Assert.Null(result);
        Assert.False(File.Exists(sandbox.FilePath));
    }

    [Fact]
    public async Task GetAsync_DoesNotReturnAnExpiredEntry()
    {
        using var sandbox = new CacheSandbox();
        var clock = new MutableTimeProvider(new DateTimeOffset(2026, 9, 10, 0, 0, 0, TimeSpan.Zero));
        var identity = TrackIdentity.Create("The Bells", ["Alice"], 180_000);
        var cache = new JsonFileBridgeCache(sandbox.FilePath, clock);
        await cache.SetAsync(identity, new LyricsLookupResult("ready", [new LyricLine(1000, "hello", null)], null), CancellationToken.None);

        clock.UtcNow = clock.UtcNow.AddDays(31);
        var result = await cache.GetAsync(identity, CancellationToken.None);

        Assert.Null(result);
    }

    private sealed class MutableTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public DateTimeOffset UtcNow { get; set; } = utcNow;

        public override DateTimeOffset GetUtcNow() => UtcNow;
    }

    private sealed class CacheSandbox : IDisposable
    {
        private readonly string _directory = Path.Combine(Path.GetTempPath(), $"NeteaseLyricsBridgeTests-{Guid.NewGuid():N}");

        public CacheSandbox()
        {
            Directory.CreateDirectory(_directory);
        }

        public string FilePath => Path.Combine(_directory, "lyrics-cache.json");

        public void Dispose()
        {
            if (Directory.Exists(_directory))
            {
                Directory.Delete(_directory, recursive: true);
            }
        }
    }
}
