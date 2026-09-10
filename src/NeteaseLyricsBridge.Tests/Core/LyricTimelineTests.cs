using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Core;

namespace NeteaseLyricsBridge.Tests.Core;

public sealed class LyricTimelineTests
{
    private static readonly IReadOnlyList<LyricLine> Lines =
    [
        new LyricLine(1000, "one", null),
        new LyricLine(2000, "two", "二"),
        new LyricLine(3000, "three", null)
    ];

    [Fact]
    public void Select_ReturnsCurrentAndNextAtBoundary()
    {
        var selection = LyricTimeline.Select(Lines, 2000);

        Assert.Equal("two", selection.Current?.Original);
        Assert.Equal("three", selection.Next?.Original);
    }

    [Fact]
    public void Select_ReturnsFirstAsNextBeforeFirstLine()
    {
        var selection = LyricTimeline.Select(Lines, 999);

        Assert.Null(selection.Current);
        Assert.Equal("one", selection.Next?.Original);
    }

    [Fact]
    public void Select_ReturnsLastWithoutNextAfterFinalLine()
    {
        var selection = LyricTimeline.Select(Lines, 3001);

        Assert.Equal("three", selection.Current?.Original);
        Assert.Null(selection.Next);
    }

    [Fact]
    public void Select_ReturnsEmptySelectionForEmptyLyrics()
    {
        var selection = LyricTimeline.Select([], 1000);

        Assert.Null(selection.Current);
        Assert.Null(selection.Next);
    }
}
