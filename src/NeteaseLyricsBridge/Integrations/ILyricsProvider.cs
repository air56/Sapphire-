using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Core;

namespace NeteaseLyricsBridge.Integrations;

public sealed record LyricsLookupResult(
    string Status,
    IReadOnlyList<LyricLine> Lines,
    string? ErrorCode);

public interface ILyricsProvider
{
    Task<LyricsLookupResult> GetLyricsAsync(TrackIdentity identity, CancellationToken cancellationToken);
}
