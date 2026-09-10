using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Core;

namespace NeteaseLyricsBridge.Tests.Core;

public sealed class LrcParserTests
{
    [Fact]
    public void ParseAndMerge_ExpandsTimestampsAndAttachesTranslationByTime()
    {
        const string original = "[00:01.50][00:03.00]hello\n[00:05.00]world\n[ar:artist]";
        const string translation = "[00:01.50]你好\n[00:05.00]世界";

        var lines = LrcParser.ParseAndMerge(original, translation);

        Assert.Collection(lines,
            line => Assert.Equal(new LyricLine(1500, "hello", "你好"), line),
            line => Assert.Equal(new LyricLine(3000, "hello", null), line),
            line => Assert.Equal(new LyricLine(5000, "world", "世界"), line));
    }

    [Fact]
    public void ParseAndMerge_SkipsMetadataEmptyTextAndMalformedLines()
    {
        const string original = "[ar:artist]\n[00:01.00]\nno timestamp\n[0x:02.00]broken\n[01:02]valid";

        var lines = LrcParser.ParseAndMerge(original, translation: null);

        var line = Assert.Single(lines);
        Assert.Equal(new LyricLine(62_000, "valid", null), line);
    }

    [Fact]
    public void ParseAndMerge_UsesLastNonEmptyTranslationForSameTimestamp()
    {
        const string original = "[00:01.00]hello";
        const string translation = "[00:01.00]first\n[00:01.00]\n[00:01.00]last";

        var line = Assert.Single(LrcParser.ParseAndMerge(original, translation));

        Assert.Equal("last", line.Translation);
    }

    [Fact]
    public void ParseAndMerge_ReturnsEmptyWhenOriginalIsEmpty()
    {
        Assert.Empty(LrcParser.ParseAndMerge("", "[00:01.00]翻译"));
    }
}
