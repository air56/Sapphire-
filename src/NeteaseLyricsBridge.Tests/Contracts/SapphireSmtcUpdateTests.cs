using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Integrations;

namespace NeteaseLyricsBridge.Tests.Contracts;

public sealed class SapphireSmtcUpdateTests
{
    [Fact]
    public void TryToMediaUpdate_ConvertsTrustedNeteasePayload()
    {
        var timestamp = new DateTimeOffset(2026, 9, 11, 3, 0, 0, TimeSpan.Zero);
        var input = new SapphireSmtcUpdate(
            "网易云音乐",
            "真夜中のドア〜stay with me",
            ["松原みき"],
            "Pocket Park",
            279_000,
            "Playing",
            42_000,
            timestamp);

        var converted = input.TryToMediaUpdate(out var update);

        Assert.True(converted);
        Assert.NotNull(update);
        Assert.Equal("网易云音乐", update.SourceAppUserModelId);
        Assert.Equal("真夜中のドア〜stay with me", update.Title);
        Assert.Equal(["松原みき"], update.Artists);
        Assert.Equal(PlaybackState.Playing, update.State);
        Assert.Equal(42_000, update.PositionMs);
        Assert.Equal(timestamp, update.UpdatedAt);
    }

    [Fact]
    public void TryToMediaUpdate_RejectsNonNeteaseOrUntitledPayloads()
    {
        var spotify = new SapphireSmtcUpdate("Spotify", "Other song", ["Artist"], null, 1, "Playing", 1, DateTimeOffset.UtcNow);
        var missingTitle = new SapphireSmtcUpdate("网易云音乐", " ", [], null, 1, "Playing", 1, DateTimeOffset.UtcNow);

        Assert.False(spotify.TryToMediaUpdate(out var spotifyUpdate));
        Assert.Null(spotifyUpdate);
        Assert.False(missingTitle.TryToMediaUpdate(out var missingTitleUpdate));
        Assert.Null(missingTitleUpdate);
    }

    [Fact]
    public void TryToMediaUpdate_ClampsTimelineAndNormalizesUnknownPlaybackState()
    {
        var input = new SapphireSmtcUpdate(
            "com.netease.cloudmusic",
            "Song",
            [" ", " Alice "],
            " ",
            -1,
            "unknown",
            -5,
            null);

        var converted = input.TryToMediaUpdate(out var update);

        Assert.True(converted);
        Assert.NotNull(update);
        Assert.Equal(["Alice"], update.Artists);
        Assert.Null(update.Album);
        Assert.Equal(0, update.DurationMs);
        Assert.Equal(0, update.PositionMs);
        Assert.Equal(PlaybackState.Stopped, update.State);
    }
}
