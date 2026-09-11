using NeteaseLyricsBridge.Contracts;
using Windows.Media.Control;

namespace NeteaseLyricsBridge.Integrations;

public sealed class WindowsSmtcSessionFeed : ISmtcSessionFeed
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private GlobalSystemMediaTransportControlsSessionManager? _manager;
    private GlobalSystemMediaTransportControlsSession? _activeSession;
    private Func<MediaUpdate, Task>? _onUpdate;
    private bool _publishedWaitingSnapshot;
    private bool _started;

    public async Task StartAsync(Func<MediaUpdate, Task> onUpdate, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(onUpdate);

        lock (_gate)
        {
            if (_started)
            {
                throw new InvalidOperationException("The SMTC session feed has already been started.");
            }

            _started = true;
            _onUpdate = onUpdate;
        }

        try
        {
            _manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
            cancellationToken.ThrowIfCancellationRequested();
            _manager.CurrentSessionChanged += OnManagerSessionsChanged;
            _manager.SessionsChanged += OnManagerSessionsChanged;
            await RefreshActiveSessionAsync(cancellationToken);
            _ = PollActiveSessionAsync(cancellationToken);
        }
        catch
        {
            lock (_gate)
            {
                _started = false;
                _onUpdate = null;
            }

            throw;
        }
    }

    private async void OnManagerSessionsChanged(
        GlobalSystemMediaTransportControlsSessionManager sender,
        object args) =>
        await IgnoreFailureAsync(RefreshActiveSessionAsync(CancellationToken.None));

    private void OnMediaPropertiesChanged(
        GlobalSystemMediaTransportControlsSession sender,
        MediaPropertiesChangedEventArgs args) =>
        _ = IgnoreFailureAsync(PublishActiveSessionAsync(sender));

    private void OnPlaybackInfoChanged(
        GlobalSystemMediaTransportControlsSession sender,
        PlaybackInfoChangedEventArgs args) =>
        _ = IgnoreFailureAsync(PublishActiveSessionAsync(sender));

    private void OnTimelinePropertiesChanged(
        GlobalSystemMediaTransportControlsSession sender,
        TimelinePropertiesChangedEventArgs args) =>
        _ = IgnoreFailureAsync(PublishActiveSessionAsync(sender));

    private async Task RefreshActiveSessionAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var manager = _manager ?? throw new InvalidOperationException("The SMTC session manager is not available.");
            var nextSession = FindNeteaseSession(manager);
            if (!ReferenceEquals(_activeSession, nextSession))
            {
                DetachActiveSession();
                _activeSession = nextSession;
                AttachActiveSession();
            }

            if (_activeSession is null)
            {
                if (_publishedWaitingSnapshot)
                {
                    return;
                }

                _publishedWaitingSnapshot = true;
                await PublishAsync(new MediaUpdate(
                    null,
                    null,
                    [],
                    null,
                    null,
                    0,
                    PlaybackState.Stopped,
                    0,
                    DateTimeOffset.UtcNow,
                    MediaUpdateSource.WindowsSmtc));
                return;
            }

            _publishedWaitingSnapshot = false;
            await PublishSessionAsync(_activeSession);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task PollActiveSessionAsync(CancellationToken cancellationToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(250));
        try
        {
            while (await timer.WaitForNextTickAsync(cancellationToken))
            {
                try
                {
                    // SMTC does not guarantee TimelinePropertiesChanged for every
                    // playback-position change. Polling keeps the public snapshot
                    // current even when the player only emits play/pause events.
                    await RefreshActiveSessionAsync(cancellationToken);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    return;
                }
                catch
                {
                    // A session may disappear during a timer tick; the next tick
                    // or manager event will recover it.
                }
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Normal shutdown.
        }
    }

    private async Task PublishActiveSessionAsync(GlobalSystemMediaTransportControlsSession session)
    {
        await _gate.WaitAsync();
        try
        {
            if (!ReferenceEquals(_activeSession, session))
            {
                return;
            }

            await PublishSessionAsync(session);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task PublishSessionAsync(GlobalSystemMediaTransportControlsSession session)
    {
        var properties = await session.TryGetMediaPropertiesAsync();
        if (!ReferenceEquals(_activeSession, session))
        {
            return;
        }

        var timeline = session.GetTimelineProperties();
        var playbackInfo = session.GetPlaybackInfo();
        var artist = properties.Artist;
        var duration = Math.Max(0, (long)(timeline.EndTime - timeline.StartTime).TotalMilliseconds);
        var position = Math.Max(0, (long)timeline.Position.TotalMilliseconds);

        await PublishAsync(new MediaUpdate(
            session.SourceAppUserModelId,
            properties.Title,
            string.IsNullOrWhiteSpace(artist) ? [] : [artist],
            properties.AlbumTitle,
            null,
            duration,
            ToPlaybackState(playbackInfo.PlaybackStatus),
            position,
            DateTimeOffset.UtcNow,
                    MediaUpdateSource.WindowsSmtc));
    }

    private async Task PublishAsync(MediaUpdate update)
    {
        if (_onUpdate is not null)
        {
            await _onUpdate(update);
        }
    }

    private static GlobalSystemMediaTransportControlsSession? FindNeteaseSession(
        GlobalSystemMediaTransportControlsSessionManager manager)
    {
        var current = manager.GetCurrentSession();
        if (IsNeteaseSession(current))
        {
            return current;
        }

        return manager.GetSessions().FirstOrDefault(IsNeteaseSession);
    }

    private static bool IsNeteaseSession(GlobalSystemMediaTransportControlsSession? session) =>
        session is not null &&
        (session.SourceAppUserModelId.Contains("netease", StringComparison.OrdinalIgnoreCase) ||
         session.SourceAppUserModelId.Contains("cloudmusic", StringComparison.OrdinalIgnoreCase));

    private static PlaybackState ToPlaybackState(GlobalSystemMediaTransportControlsSessionPlaybackStatus status) =>
        status switch
        {
            GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing => PlaybackState.Playing,
            GlobalSystemMediaTransportControlsSessionPlaybackStatus.Paused => PlaybackState.Paused,
            _ => PlaybackState.Stopped
        };

    private void AttachActiveSession()
    {
        if (_activeSession is null)
        {
            return;
        }

        _activeSession.MediaPropertiesChanged += OnMediaPropertiesChanged;
        _activeSession.PlaybackInfoChanged += OnPlaybackInfoChanged;
        _activeSession.TimelinePropertiesChanged += OnTimelinePropertiesChanged;
    }

    private void DetachActiveSession()
    {
        if (_activeSession is null)
        {
            return;
        }

        _activeSession.MediaPropertiesChanged -= OnMediaPropertiesChanged;
        _activeSession.PlaybackInfoChanged -= OnPlaybackInfoChanged;
        _activeSession.TimelinePropertiesChanged -= OnTimelinePropertiesChanged;
    }

    private static async Task IgnoreFailureAsync(Task task)
    {
        try
        {
            await task;
        }
        catch
        {
            // A session can disappear between an SMTC event and its property read.
        }
    }
}


