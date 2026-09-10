using NeteaseLyricsBridge.Core;

namespace NeteaseLyricsBridge.Tests.Core;

public sealed class SongMatchScorerTests
{
    [Fact]
    public void PickBest_RejectsCandidateBelowConfidenceThreshold()
    {
        var query = TrackIdentity.Create("a song", ["artist"], 180_000);
        var candidates = new[] { new SongCandidate(1, "another song", ["other"], 180_000) };

        Assert.Null(new SongMatchScorer().PickBest(query, candidates));
    }

    [Fact]
    public void PickBest_RejectsTieCloserThanPointZeroEight()
    {
        var query = TrackIdentity.Create("hello", ["artist"], 180_000);
        var candidates = new[]
        {
            new SongCandidate(1, "hello", ["artist"], 180_000),
            new SongCandidate(2, "hello", ["artist"], 180_100)
        };

        Assert.Null(new SongMatchScorer().PickBest(query, candidates));
    }

    [Fact]
    public void PickBest_ReturnsHighConfidenceWinner()
    {
        var query = TrackIdentity.Create("The Bells", ["Alice", "Zed"], 180_000);
        var candidates = new[]
        {
            new SongCandidate(1, "The Bells", ["Zed", "Alice"], 180_020),
            new SongCandidate(2, "Other Song", ["Other"], 200_000)
        };

        var match = new SongMatchScorer().PickBest(query, candidates);

        Assert.NotNull(match);
        Assert.Equal(1, match!.SongId);
    }
}
