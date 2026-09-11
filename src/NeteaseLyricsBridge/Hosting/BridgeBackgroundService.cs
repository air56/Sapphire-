using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Core;
using NeteaseLyricsBridge.Integrations;

namespace NeteaseLyricsBridge.Hosting;

public sealed class BridgeBackgroundService(
    ISmtcSessionFeed sessionFeed,
    TrackSessionCoordinator coordinator,
    BridgeStateStore store,
    ILogger<BridgeBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        coordinator.SnapshotChanged += OnSnapshotChanged;
        try
        {
            await store.PublishAsync(coordinator.Current);
            await sessionFeed.StartAsync(update => coordinator.ApplyMediaAsync(update), stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown.
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Failed to start the Windows media session feed.");
            var failed = coordinator.Current with
            {
                Bridge = new BridgeDto("error", "smtcUnavailable")
            };
            await store.PublishAsync(failed);

            try
            {
                await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Normal shutdown after an initialization failure.
            }
        }
        finally
        {
            coordinator.SnapshotChanged -= OnSnapshotChanged;
        }
    }

    private void OnSnapshotChanged(BridgeSnapshot snapshot) =>
        _ = store.PublishAsync(snapshot).AsTask();
}
