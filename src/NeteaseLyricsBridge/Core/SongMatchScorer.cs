using System.Text.RegularExpressions;

namespace NeteaseLyricsBridge.Core;

public sealed record SongCandidate(
    long SongId,
    string Title,
    IReadOnlyList<string> Artists,
    long DurationMs);

public sealed partial class SongMatchScorer
{
    private const double ConfidenceThreshold = 0.78;
    private const double SeparationThreshold = 0.08;

    public SongCandidate? PickBest(TrackIdentity query, IReadOnlyList<SongCandidate> candidates)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(candidates);

        var ranked = candidates
            .Select(candidate => new RankedCandidate(candidate, Score(query, candidate)))
            .OrderByDescending(entry => entry.Score)
            .ThenBy(entry => entry.Candidate.SongId)
            .ToArray();

        if (ranked.Length == 0 || ranked[0].Score < ConfidenceThreshold)
        {
            return null;
        }

        if (ranked.Length > 1 && ranked[0].Score - ranked[1].Score < SeparationThreshold)
        {
            return null;
        }

        return ranked[0].Candidate;
    }

    private static double Score(TrackIdentity query, SongCandidate candidate)
    {
        var titleScore = Jaccard(Tokenize(query.Title), Tokenize(candidate.Title));
        var artistScore = Jaccard(
            Tokenize(string.Join(' ', query.Artists)),
            Tokenize(string.Join(' ', candidate.Artists ?? [])));
        var durationScore = Math.Max(0, 1 - (Math.Abs(query.DurationMs - candidate.DurationMs) / 5000d));

        return (titleScore * 0.65) + (artistScore * 0.25) + (durationScore * 0.10);
    }

    private static double Jaccard(IReadOnlySet<string> left, IReadOnlySet<string> right)
    {
        if (left.Count == 0 || right.Count == 0)
        {
            return 0;
        }

        var intersection = left.Count(token => right.Contains(token));
        var union = left.Count + right.Count - intersection;
        return union == 0 ? 0 : (double)intersection / union;
    }

    private static IReadOnlySet<string> Tokenize(string? value) =>
        TokenRegex()
            .Matches(value ?? string.Empty)
            .Select(match => match.Value.ToLowerInvariant())
            .ToHashSet(StringComparer.Ordinal);

    [GeneratedRegex("[\\p{L}\\p{N}]+")]
    private static partial Regex TokenRegex();

    private sealed record RankedCandidate(SongCandidate Candidate, double Score);
}
