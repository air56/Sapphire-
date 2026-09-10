using System.Text.RegularExpressions;

namespace NeteaseLyricsBridge.Core;

public sealed record TrackIdentity(
    string Title,
    IReadOnlyList<string> Artists,
    long DurationMs)
{
    public string CacheKey => $"{Title}|{string.Join(',', Artists)}|{DurationMs}";

    public static TrackIdentity Create(
        string title,
        IReadOnlyList<string> artists,
        long durationMs)
    {
        ArgumentNullException.ThrowIfNull(title);
        ArgumentNullException.ThrowIfNull(artists);

        var normalizedArtists = artists
            .Where(artist => !string.IsNullOrWhiteSpace(artist))
            .Select(NormalizeText)
            .Where(artist => artist.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(artist => artist, StringComparer.Ordinal)
            .ToArray();

        return new TrackIdentity(
            NormalizeText(title),
            normalizedArtists,
            Math.Max(0, durationMs));
    }

    private static string NormalizeText(string value) =>
        Regex.Replace(value.Trim(), @"\s+", " ").ToLowerInvariant();
}
