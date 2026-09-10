using NeteaseLyricsBridge.Core;

namespace NeteaseLyricsBridge.Tests.Core;

public sealed class TrackIdentityTests
{
    [Fact]
    public void CacheKey_NormalizesCaseWhitespaceAndArtistOrder()
    {
        var identity = TrackIdentity.Create(
            title: "  The   Bells ",
            artists: ["Zed", " Alice "],
            durationMs: 180_020);

        Assert.Equal("the bells|alice,zed|180020", identity.CacheKey);
    }
}