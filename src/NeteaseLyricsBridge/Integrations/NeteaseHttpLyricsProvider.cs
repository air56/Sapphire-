using System.Net.Http.Headers;
using System.Text.Json;
using NeteaseLyricsBridge.Core;

namespace NeteaseLyricsBridge.Integrations;

public sealed class NeteaseHttpLyricsProvider(HttpClient httpClient, SongMatchScorer scorer, IBridgeCache? cache = null) : ILyricsProvider
{
    private static readonly Uri NeteaseHome = new("https://music.163.com/");
    private const string DesktopUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

    public async Task<LyricsLookupResult> GetLyricsAsync(TrackIdentity identity, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(identity);

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(10));

        try
        {
            var cached = await GetCachedAsync(identity, timeout.Token);
            if (cached is not null)
            {
                return cached;
            }

            var candidates = await SearchAsync(identity, timeout.Token);
            var selected = scorer.PickBest(identity, candidates);
            if (selected is null)
            {
                return Unavailable();
            }

            var (original, translation) = await GetLyricTextsAsync(selected.SongId, timeout.Token);
            if (string.IsNullOrWhiteSpace(original))
            {
                return Unavailable();
            }

            var lines = LrcParser.ParseAndMerge(original, translation);
            var result = lines.Count == 0
                ? Unavailable()
                : new LyricsLookupResult("ready", lines, null);

            if (result.Status == "ready")
            {
                await SetCachedAsync(identity, result, timeout.Token);
            }

            return result;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new LyricsLookupResult("error", [], "timeout");
        }
        catch (HttpRequestException)
        {
            return new LyricsLookupResult("error", [], "network");
        }
        catch (JsonException)
        {
            return new LyricsLookupResult("error", [], "invalidResponse");
        }
    }

    private async Task<LyricsLookupResult?> GetCachedAsync(TrackIdentity identity, CancellationToken cancellationToken)
    {
        if (cache is null)
        {
            return null;
        }

        try
        {
            return await cache.GetAsync(identity, cancellationToken);
        }
        catch (IOException)
        {
            return null;
        }
        catch (UnauthorizedAccessException)
        {
            return null;
        }
    }

    private async Task SetCachedAsync(TrackIdentity identity, LyricsLookupResult result, CancellationToken cancellationToken)
    {
        if (cache is null)
        {
            return;
        }

        try
        {
            await cache.SetAsync(identity, result, cancellationToken);
        }
        catch (IOException)
        {
            // Disk cache failures must not hide successfully fetched lyrics.
        }
        catch (UnauthorizedAccessException)
        {
            // Disk cache failures must not hide successfully fetched lyrics.
        }
    }
    private async Task<IReadOnlyList<SongCandidate>> SearchAsync(TrackIdentity identity, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(
            HttpMethod.Post,
            "/api/search/get/web?csrf_token=",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["s"] = identity.Title,
                ["type"] = "1",
                ["limit"] = "10",
                ["offset"] = "0"
            }));
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        if (!document.RootElement.TryGetProperty("result", out var result) ||
            !result.TryGetProperty("songs", out var songs) ||
            songs.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var candidates = new List<SongCandidate>();
        foreach (var song in songs.EnumerateArray())
        {
            if (!TryGetInt64(song, "id", out var songId) ||
                !TryGetString(song, "name", out var title))
            {
                continue;
            }

            var artists = ReadArtists(song);
            var duration = ReadDuration(song);
            candidates.Add(new SongCandidate(songId, title, artists, duration));
        }

        return candidates;
    }

    private async Task<(string? Original, string? Translation)> GetLyricTextsAsync(long songId, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(
            HttpMethod.Get,
            $"/api/song/lyric?os=pc&id={songId}&lv=-1&kv=-1&tv=-1");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        return (
            GetNestedString(document.RootElement, "lrc", "lyric"),
            GetNestedString(document.RootElement, "tlyric", "lyric"));
    }

    private static HttpRequestMessage CreateRequest(HttpMethod method, string relativeUri, HttpContent? content = null)
    {
        var request = new HttpRequestMessage(method, relativeUri) { Content = content };
        request.Headers.Referrer = NeteaseHome;
        request.Headers.TryAddWithoutValidation("User-Agent", DesktopUserAgent);
        return request;
    }

    private static IReadOnlyList<string> ReadArtists(JsonElement song)
    {
        if (!song.TryGetProperty("artists", out var artists) && !song.TryGetProperty("ar", out artists))
        {
            return [];
        }

        if (artists.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return artists
            .EnumerateArray()
            .Select(artist => TryGetString(artist, "name", out var name) ? name : null)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Cast<string>()
            .ToArray();
    }

    private static long ReadDuration(JsonElement song)
    {
        return TryGetInt64(song, "duration", out var duration)
            ? duration
            : TryGetInt64(song, "dt", out duration)
                ? duration
                : 0;
    }

    private static string? GetNestedString(JsonElement element, string parent, string child) =>
        element.TryGetProperty(parent, out var parentElement) &&
        TryGetString(parentElement, child, out var value)
            ? value
            : null;

    private static bool TryGetString(JsonElement element, string property, out string value)
    {
        value = string.Empty;
        return element.TryGetProperty(property, out var propertyValue) &&
            propertyValue.ValueKind == JsonValueKind.String &&
            (value = propertyValue.GetString() ?? string.Empty) is not null;
    }

    private static bool TryGetInt64(JsonElement element, string property, out long value)
    {
        value = 0;
        return element.TryGetProperty(property, out var propertyValue) && propertyValue.TryGetInt64(out value);
    }

    private static LyricsLookupResult Unavailable() => new("unavailable", [], null);
}
