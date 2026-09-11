using Microsoft.Extensions.Logging.Abstractions;
using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Core;
using NeteaseLyricsBridge.Hosting;
using NeteaseLyricsBridge.Integrations;

namespace NeteaseLyricsBridge.Tests.Hosting;

public sealed class BridgeBackgroundServiceTests
{
    [Fact]
    public async Task KeepsPublishingLyricsSnapshotsAfterTheSessionFeedHasStarted()
    {
        var sessionFeed = new ManualSmtcSessionFeed();
        var provider = new ControllableLyricsProvider();
        var coordinator = new TrackSessionCoordinator(provider);
        var store = new BridgeStateStore(coordinator.Current, new SseClientRegistry());
        var service = new BridgeBackgroundService(
            sessionFeed,
            coordinator,
            store,
            NullLogger<BridgeBackgroundService>.Instance);

        await service.StartAsync(CancellationToken.None);
        try
        {
            await sessionFeed.WaitUntilStartedAsync();
            await sessionFeed.PublishAsync(MediaUpdate.Playing("song", ["artist"], 180_000, 1_000, DateTimeOffset.UtcNow));
            await WaitUntilAsync(() => provider.RequestCount == 1);

            provider.Complete("loaded lyric");
            await WaitUntilAsync(() => store.Current.Lyrics.Status == "ready");

            Assert.Equal("loaded lyric", store.Current.Lyrics.Lines.Single().Original);
        }
        finally
        {
            await service.StopAsync(CancellationToken.None);
            service.Dispose();
        }
    }

    private static async Task WaitUntilAsync(Func<bool> condition)
    {
        var deadline = DateTime.UtcNow.AddSeconds(2);
        while (!condition())
        {
            if (DateTime.UtcNow > deadline)
            {
                throw new TimeoutException("Expected bridge state was not published.");
            }

            await Task.Delay(10);
        }
    }

    private sealed class ManualSmtcSessionFeed : ISmtcSessionFeed
    {
        private readonly TaskCompletionSource<Func<MediaUpdate, Task>> _onUpdate = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public Task StartAsync(Func<MediaUpdate, Task> onUpdate, CancellationToken cancellationToken)
        {
            _onUpdate.TrySetResult(onUpdate);
            return Task.CompletedTask;
        }

        public async Task WaitUntilStartedAsync() => _ = await _onUpdate.Task;

        public async Task PublishAsync(MediaUpdate update)
        {
            var onUpdate = await _onUpdate.Task;
            await onUpdate(update);
        }
    }

    private sealed class ControllableLyricsProvider : ILyricsProvider
    {
        private TaskCompletionSource<LyricsLookupResult>? _result;

        public int RequestCount { get; private set; }

        public Task<LyricsLookupResult> GetLyricsAsync(TrackIdentity identity, CancellationToken cancellationToken)
        {
            RequestCount++;
            _result = new TaskCompletionSource<LyricsLookupResult>(TaskCreationOptions.RunContinuationsAsynchronously);
            return _result.Task;
        }

        public void Complete(string lyric) =>
            _result!.SetResult(new LyricsLookupResult("ready", [new LyricLine(1_000, lyric, null)], null));
    }
}