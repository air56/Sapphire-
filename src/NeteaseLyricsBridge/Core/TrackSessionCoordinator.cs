using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Integrations;

namespace NeteaseLyricsBridge.Core;

public sealed class TrackSessionCoordinator
{
    private readonly object _sync = new();
    private readonly ILyricsProvider _lyricsProvider;
    private CancellationTokenSource? _lyricsCancellation;
    private string? _identityCacheKey;
    private BridgeSnapshot _current = CreateWaitingSnapshot();

    public event Action<BridgeSnapshot>? SnapshotChanged;

    public TrackSessionCoordinator(ILyricsProvider lyricsProvider)
    {
        _lyricsProvider = lyricsProvider ?? throw new ArgumentNullException(nameof(lyricsProvider));
    }

    public BridgeSnapshot Current
    {
        get
        {
            lock (_sync)
            {
                return _current;
            }
        }
    }

    public Task ApplyMediaAsync(MediaUpdate update)
    {
        ArgumentNullException.ThrowIfNull(update);

        if (!update.IsNeteaseSession || string.IsNullOrWhiteSpace(update.Title))
        {
            SetWaitingForPlayer(update.UpdatedAt);
            return Task.CompletedTask;
        }

        var identity = TrackIdentity.Create(update.Title, update.Artists ?? [], update.DurationMs);
        var playback = new PlaybackDto(update.State, Math.Max(0, update.PositionMs), update.UpdatedAt);
        var track = new TrackDto(
            update.Title.Trim(),
            update.Artists ?? [],
            update.Album,
            update.Artwork,
            Math.Max(0, update.DurationMs));

        lock (_sync)
        {
            if (string.Equals(_identityCacheKey, identity.CacheKey, StringComparison.Ordinal))
            {
                _current = _current with
                {
                    Track = track,
                    Playback = playback,
                    Bridge = new BridgeDto("ready", null)
                };
                NotifyChanged(_current);
                return Task.CompletedTask;
            }

            _lyricsCancellation?.Cancel();
            _lyricsCancellation = new CancellationTokenSource();
            _identityCacheKey = identity.CacheKey;

            var trackSessionId = Guid.NewGuid().ToString("N");
            _current = new BridgeSnapshot(
                trackSessionId,
                track,
                playback,
                new LyricsDto("loading", []),
                new BridgeDto("ready", null));

            NotifyChanged(_current);
            _ = LoadLyricsAsync(trackSessionId, identity, _lyricsCancellation.Token);
        }

        return Task.CompletedTask;
    }

    private async Task LoadLyricsAsync(string trackSessionId, TrackIdentity identity, CancellationToken cancellationToken)
    {
        LyricsLookupResult result;
        try
        {
            result = await _lyricsProvider.GetLyricsAsync(identity, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return;
        }
        catch
        {
            result = new LyricsLookupResult("error", [], "lyricsLookupFailed");
        }

        lock (_sync)
        {
            if (!string.Equals(_current.TrackSessionId, trackSessionId, StringComparison.Ordinal))
            {
                return;
            }

            _current = _current with
            {
                Lyrics = new LyricsDto(result.Status, result.Lines),
                Bridge = result.Status == "error"
                    ? new BridgeDto("error", result.ErrorCode)
                    : new BridgeDto("ready", null)
            };
            NotifyChanged(_current);
        }
    }

    private void SetWaitingForPlayer(DateTimeOffset updatedAt)
    {
        lock (_sync)
        {
            _lyricsCancellation?.Cancel();
            _lyricsCancellation = null;
            _identityCacheKey = null;
            _current = new BridgeSnapshot(
                Guid.NewGuid().ToString("N"),
                null,
                new PlaybackDto(PlaybackState.Stopped, 0, updatedAt),
                new LyricsDto("unavailable", []),
                new BridgeDto("waitingForPlayer", null));
            NotifyChanged(_current);
        }
    }

    private void NotifyChanged(BridgeSnapshot snapshot) =>
        SnapshotChanged?.Invoke(snapshot);

    private static BridgeSnapshot CreateWaitingSnapshot() =>
        new(
            Guid.NewGuid().ToString("N"),
            null,
            new PlaybackDto(PlaybackState.Stopped, 0, DateTimeOffset.UtcNow),
            new LyricsDto("unavailable", []),
            new BridgeDto("waitingForPlayer", null));
}
