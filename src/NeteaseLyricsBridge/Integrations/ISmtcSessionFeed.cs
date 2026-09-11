using NeteaseLyricsBridge.Contracts;

namespace NeteaseLyricsBridge.Integrations;

public enum MediaUpdateSource
{
    Unknown = 0,
    SapphireWebChannel = 1,
    WindowsSmtc = 2
}

public sealed record MediaUpdate(
    string? SourceAppUserModelId,
    string? Title,
    IReadOnlyList<string> Artists,
    string? Album,
    string? Artwork,
    long DurationMs,
    PlaybackState State,
    long PositionMs,
    DateTimeOffset UpdatedAt,
    MediaUpdateSource Source = MediaUpdateSource.Unknown)
{
    public bool IsNeteaseSession =>
        !string.IsNullOrWhiteSpace(SourceAppUserModelId) &&
        (SourceAppUserModelId.Contains("netease", StringComparison.OrdinalIgnoreCase) ||
         SourceAppUserModelId.Contains("cloudmusic", StringComparison.OrdinalIgnoreCase) ||
         SourceAppUserModelId.Contains("网易云", StringComparison.OrdinalIgnoreCase));

    public static MediaUpdate Playing(
        string title,
        IReadOnlyList<string> artists,
        long durationMs,
        long positionMs,
        DateTimeOffset updatedAt) =>
        new(
            "com.netease.cloudmusic",
            title,
            artists,
            null,
            null,
            durationMs,
            PlaybackState.Playing,
            positionMs,
            updatedAt);
}

public interface ISmtcSessionFeed
{
    Task StartAsync(Func<MediaUpdate, Task> onUpdate, CancellationToken cancellationToken);
}
