using NeteaseLyricsBridge.Contracts;

namespace NeteaseLyricsBridge.Core;

public sealed record LyricSelection(LyricLine? Current, LyricLine? Next);

public static class LyricTimeline
{
    public static LyricSelection Select(IReadOnlyList<LyricLine> lines, long positionMs)
    {
        ArgumentNullException.ThrowIfNull(lines);

        if (lines.Count == 0)
        {
            return new LyricSelection(null, null);
        }

        var low = 0;
        var high = lines.Count - 1;
        var currentIndex = -1;

        while (low <= high)
        {
            var middle = low + ((high - low) / 2);
            if (lines[middle].StartMs <= positionMs)
            {
                currentIndex = middle;
                low = middle + 1;
            }
            else
            {
                high = middle - 1;
            }
        }

        if (currentIndex < 0)
        {
            return new LyricSelection(null, lines[0]);
        }

        var next = currentIndex + 1 < lines.Count
            ? lines[currentIndex + 1]
            : null;

        return new LyricSelection(lines[currentIndex], next);
    }
}
