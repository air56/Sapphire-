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
