using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Core;
using NeteaseLyricsBridge.Integrations;

namespace NeteaseLyricsBridge.Tests.Core;

public sealed class TrackSessionCoordinatorTests
{
    [Fact]
    public async Task SwitchTrack_DiscardsLateLyricsFromPreviousSession()
    {
        var provider = new ControllableLyricsProvider();
        var coordinator = new TrackSessionCoordinator(provider);
        var now = DateTimeOffset.UtcNow;

        await coordinator.ApplyMediaAsync(MediaUpdate.Playing("song A", ["artist"], 180_000, 1_000, now));
        await coordinator.ApplyMediaAsync(MediaUpdate.Playing("song B", ["artist"], 200_000, 2_000, now.AddSeconds(1)));
        Assert.Equal(2, provider.RequestCount);

        provider.CompleteRequest(1, "song B lyric");
        await WaitUntilAsync(() => coordinator.Current.Lyrics.Lines.FirstOrDefault()?.Original == "song B lyric");
        provider.CompleteRequest(0, "song A lyric");
        await Task.Delay(50);

        var snapshot = coordinator.Current;
        Assert.Equal("song B", snapshot.Track!.Title);
        Assert.Equal("song B lyric", snapshot.Lyrics.Lines.Single().Original);
    }

    [Fact]
    public async Task PauseAndSeek_UpdateCurrentPlaybackWithoutStartingAnotherLookup()
    {
        var provider = new ControllableLyricsProvider();
        var coordinator = new TrackSessionCoordinator(provider);
        var playing = MediaUpdate.Playing("song", ["artist"], 180_000, 1_000, DateTimeOffset.UtcNow);

        await coordinator.ApplyMediaAsync(playing);
        var paused = playing with
        {
            State = PlaybackState.Paused,
            PositionMs = 2_000,
            UpdatedAt = playing.UpdatedAt.AddSeconds(1)
        };
        await coordinator.ApplyMediaAsync(paused);
        await coordinator.ApplyMediaAsync(paused with
        {
            PositionMs = 90_000,
            UpdatedAt = playing.UpdatedAt.AddSeconds(2)
        });

        Assert.Equal(1, provider.RequestCount);
        Assert.Equal(PlaybackState.Paused, coordinator.Current.Playback.State);
        Assert.Equal(90_000, coordinator.Current.Playback.PositionMs);
    }

    [Fact]
    public async Task ApplyMediaAsync_ReportsWaitingForPlayerWhenNoNeteaseSessionExists()
    {
        var coordinator = new TrackSessionCoordinator(new ControllableLyricsProvider());

        await coordinator.ApplyMediaAsync(new MediaUpdate(
            SourceAppUserModelId: "com.spotify.music",
            Title: "other song",
            Artists: ["artist"],
            Album: null,
            Artwork: null,
            DurationMs: 180_000,
            State: PlaybackState.Playing,
            PositionMs: 0,
            UpdatedAt: DateTimeOffset.UtcNow));

        Assert.Equal("waitingForPlayer", coordinator.Current.Bridge.Status);
        Assert.Null(coordinator.Current.Track);
    }

    private static async Task WaitUntilAsync(Func<bool> condition)
    {
        var deadline = DateTime.UtcNow.AddSeconds(2);
        while (!condition())
        {
            if (DateTime.UtcNow > deadline)
            {
                throw new TimeoutException("The expected coordinator state was not published.");
            }

            await Task.Delay(10);
        }
    }

    private sealed class ControllableLyricsProvider : ILyricsProvider
    {
        private readonly List<TaskCompletionSource<LyricsLookupResult>> _requests = [];

        public int RequestCount => _requests.Count;

        public Task<LyricsLookupResult> GetLyricsAsync(TrackIdentity identity, CancellationToken cancellationToken)
        {
            var source = new TaskCompletionSource<LyricsLookupResult>(TaskCreationOptions.RunContinuationsAsynchronously);
            _requests.Add(source);
            return source.Task;
        }

        public void CompleteRequest(int index, string lyric) =>
            _requests[index].SetResult(new LyricsLookupResult(
                "ready",
                [new LyricLine(1_000, lyric, null)],
                null));
    }
}
