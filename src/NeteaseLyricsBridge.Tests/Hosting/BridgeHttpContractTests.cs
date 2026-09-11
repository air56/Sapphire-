using System.Net.Http.Json;
using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Core;
using NeteaseLyricsBridge.Integrations;

namespace NeteaseLyricsBridge.Tests.Hosting;

public sealed class BridgeHttpContractTests
{
    [Fact]
    public async Task ProductionServiceGraph_ResolvesTheHttpLyricsProvider()
    {
        await using var factory = new ProductionBridgeWebApplicationFactory();
        using var scope = factory.Services.CreateScope();

        var provider = scope.ServiceProvider.GetRequiredService<ILyricsProvider>();

        Assert.IsType<NeteaseHttpLyricsProvider>(provider);
    }

    [Fact]
    public async Task SnapshotEndpoint_ReturnsTheCurrentBridgeSnapshot()
    {
        await using var factory = new BridgeWebApplicationFactory();
        var client = factory.CreateClient();

        var response = await client.GetAsync("/v1/snapshot");
        var json = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("trackSessionId", json, StringComparison.Ordinal);
        Assert.Contains("waitingForPlayer", json, StringComparison.Ordinal);
    }

    [Fact]
    public async Task SapphireSmtcEndpoint_AcceptsNeteaseMediaAndUpdatesSnapshot()
    {
        await using var factory = new BridgeWebApplicationFactory();
        var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/v1/smtc", new
        {
            sourceAppUserModelId = "网易云音乐",
            title = "真夜中のドア",
            artists = new[] { "松原みき" },
            album = "Pocket Park",
            durationMs = 279000,
            state = "Playing",
            positionMs = 42000,
            updatedAt = DateTimeOffset.UtcNow
        });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var snapshot = await client.GetFromJsonAsync<BridgeSnapshot>("/v1/snapshot");
        Assert.Equal("真夜中のドア", snapshot!.Track!.Title);
        Assert.Equal(42000, snapshot.Playback.PositionMs);
    }

    [Fact]
    public async Task SapphireSmtcEndpoint_RejectsNonNeteaseMedia()
    {
        await using var factory = new BridgeWebApplicationFactory();
        using var response = await factory.CreateClient().PostAsJsonAsync("/v1/smtc", new
        {
            sourceAppUserModelId = "Spotify",
            title = "Other song",
            artists = new[] { "Artist" },
            durationMs = 1,
            state = "Playing",
            positionMs = 0
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SapphireSmtcEndpoint_AllowsWidgetCorsPreflightForJsonPosts()
    {
        await using var factory = new BridgeWebApplicationFactory();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/v1/smtc");
        request.Headers.Add("Origin", "null");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");

        using var response = await factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("*", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Contains("POST", response.Headers.GetValues("Access-Control-Allow-Methods").Single(), StringComparison.OrdinalIgnoreCase);
        Assert.Contains("content-type", response.Headers.GetValues("Access-Control-Allow-Headers").Single(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SnapshotEndpoint_AllowsLocalWidgetOrigins()
    {
        await using var factory = new BridgeWebApplicationFactory();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/v1/snapshot");
        request.Headers.Add("Origin", "null");

        using var response = await factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("*", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }
    [Fact]
    public async Task EventsEndpoint_UsesEventStreamContentTypeAndSendsInitialSnapshot()
    {
        await using var factory = new BridgeWebApplicationFactory();
        using var response = await factory.CreateClient().GetAsync(
            "/v1/events",
            HttpCompletionOption.ResponseHeadersRead);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/event-stream", response.Content.Headers.ContentType!.MediaType);
        Assert.Contains("no-cache", response.Headers.CacheControl?.ToString(), StringComparison.OrdinalIgnoreCase);

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        var body = await response.Content.ReadAsStreamAsync(timeout.Token);
        using var reader = new StreamReader(body);
        var firstLines = new List<string>();
        while (firstLines.Count < 3 && await reader.ReadLineAsync(timeout.Token) is { } line)
        {
            firstLines.Add(line);
        }

        Assert.Contains("event: snapshot", firstLines);
        Assert.Contains(firstLines, line => line.StartsWith("data: ", StringComparison.Ordinal));
    }
}

public sealed class BridgeWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            services.AddSingleton<ISmtcSessionFeed, NoopSmtcSessionFeed>();
            services.AddSingleton<ILyricsProvider, NoopLyricsProvider>();
        });
    }

    private sealed class NoopSmtcSessionFeed : ISmtcSessionFeed
    {
        public Task StartAsync(Func<MediaUpdate, Task> onUpdate, CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }

    private sealed class NoopLyricsProvider : ILyricsProvider
    {
        public Task<LyricsLookupResult> GetLyricsAsync(TrackIdentity identity, CancellationToken cancellationToken) =>
            Task.FromResult(new LyricsLookupResult("unavailable", [], null));
    }
}

public sealed class ProductionBridgeWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
            services.AddSingleton<ISmtcSessionFeed, NoopSmtcSessionFeed>());
    }

    private sealed class NoopSmtcSessionFeed : ISmtcSessionFeed
    {
        public Task StartAsync(Func<MediaUpdate, Task> onUpdate, CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }
}
