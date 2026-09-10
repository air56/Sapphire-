using System.Globalization;
using System.Text.RegularExpressions;
using NeteaseLyricsBridge.Contracts;

namespace NeteaseLyricsBridge.Core;

public static partial class LrcParser
{
    public static IReadOnlyList<LyricLine> ParseAndMerge(string original, string? translation)
    {
        ArgumentNullException.ThrowIfNull(original);

        var translations = ParseTranslationLines(translation);
        var parsedLines = new List<(LyricLine Line, int Sequence)>();
        var sequence = 0;

        foreach (var entry in ParseEntries(original))
        {
            if (string.IsNullOrWhiteSpace(entry.Text))
            {
                continue;
            }

            parsedLines.Add((
                new LyricLine(
                    entry.StartMs,
                    entry.Text,
                    translations.GetValueOrDefault(entry.StartMs)),
                sequence++));
        }

        return parsedLines
            .OrderBy(entry => entry.Line.StartMs)
            .ThenBy(entry => entry.Sequence)
            .Select(entry => entry.Line)
            .ToArray();
    }

    private static Dictionary<long, string> ParseTranslationLines(string? translation)
    {
        var result = new Dictionary<long, string>();

        if (string.IsNullOrEmpty(translation))
        {
            return result;
        }

        foreach (var entry in ParseEntries(translation))
        {
            if (!string.IsNullOrWhiteSpace(entry.Text))
            {
                result[entry.StartMs] = entry.Text;
            }
        }

        return result;
    }

    private static IEnumerable<ParsedLrcEntry> ParseEntries(string source)
    {
        using var reader = new StringReader(source);
        string? rawLine;

        while ((rawLine = reader.ReadLine()) is not null)
        {
            var matches = TimestampTagRegex().Matches(rawLine);
            if (matches.Count == 0)
            {
                continue;
            }

            var text = rawLine[(matches[^1].Index + matches[^1].Length)..].Trim();
            foreach (Match match in matches)
            {
                if (TryParseStartMs(match, out var startMs))
                {
                    yield return new ParsedLrcEntry(startMs, text);
                }
            }
        }
    }

    private static bool TryParseStartMs(Match match, out long startMs)
    {
        startMs = 0;

        if (!int.TryParse(match.Groups["minutes"].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var minutes) ||
            !int.TryParse(match.Groups["seconds"].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var seconds))
        {
            return false;
        }

        var fraction = match.Groups["fraction"].Value;
        var milliseconds = fraction.Length switch
        {
            0 => 0,
            1 => int.Parse(fraction, CultureInfo.InvariantCulture) * 100,
            2 => int.Parse(fraction, CultureInfo.InvariantCulture) * 10,
            3 => int.Parse(fraction, CultureInfo.InvariantCulture),
            _ => 0
        };

        startMs = (minutes * 60_000L) + (seconds * 1_000L) + milliseconds;
        return true;
    }

    [GeneratedRegex(@"\[(?<minutes>\d+):(?<seconds>[0-5]\d)(?:\.(?<fraction>\d{1,3}))?\]")]
    private static partial Regex TimestampTagRegex();

    private sealed record ParsedLrcEntry(long StartMs, string Text);
}
