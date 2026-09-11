using NeteaseLyricsBridge.Contracts;

namespace NeteaseLyricsBridge.Integrations;

public sealed record SapphireSmtcUpdate(
    string? SourceAppUserModelId,
    string? Title,
    IReadOnlyList<string>? Artists,
    string? Album,
    long DurationMs,
    string? State,
    long PositionMs,
    DateTimeOffset? UpdatedAt)
{
    public bool TryToMediaUpdate(out MediaUpdate? update)
    {
        update = null;
        var sourceAppUserModelId = NormalizeText(SourceAppUserModelId);
        var title = NormalizeText(Title);
        if (sourceAppUserModelId is null || title is null)
        {
            return false;
        }

        var candidate = new MediaUpdate(
            sourceAppUserModelId,
            title,
            (Artists ?? [])
                .Select(NormalizeText)
                .Where(artist => artist is not null)
                .Cast<string>()
                .Distinct(StringComparer.Ordinal)
                .ToArray(),
            NormalizeText(Album),
            null,
            Math.Max(0, DurationMs),
            ParsePlaybackState(State),
            Math.Max(0, PositionMs),
            UpdatedAt ?? DateTimeOffset.UtcNow,
            MediaUpdateSource.SapphireWebChannel);

        if (!candidate.IsNeteaseSession)
        {
            return false;
        }

        update = candidate;
        return true;
    }

    private static PlaybackState ParsePlaybackState(string? value) =>
        Enum.TryParse<PlaybackState>(value, ignoreCase: true, out var parsed)
            ? parsed
            : PlaybackState.Stopped;

    private static string? NormalizeText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}


