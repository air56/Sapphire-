using NeteaseLyricsBridge.Core;

namespace NeteaseLyricsBridge.Integrations;

public interface IBridgeCache
{
    Task<LyricsLookupResult?> GetAsync(TrackIdentity identity, CancellationToken cancellationToken);

    Task SetAsync(TrackIdentity identity, LyricsLookupResult result, CancellationToken cancellationToken);
}
