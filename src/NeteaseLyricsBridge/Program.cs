using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Core;
using NeteaseLyricsBridge.Integrations;
using NeteaseLyricsBridge.Hosting;

const string loopbackEndpoint = "http://127.0.0.1:18763";

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls(loopbackEndpoint);

builder.Services.AddHttpClient<ILyricsProvider, NeteaseHttpLyricsProvider>(client =>
{
    client.BaseAddress = new Uri("https://music.163.com/");
});
builder.Services.AddSingleton<IBridgeCache>(_ =>
{
    var cachePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "NeteaseLyricsBridge",
        "lyrics-cache.json");
    return new JsonFileBridgeCache(cachePath);
});
builder.Services.AddSingleton<ISmtcSessionFeed, WindowsSmtcSessionFeed>();
builder.Services.AddSingleton<TrackSessionCoordinator>();
builder.Services.AddSingleton<SseClientRegistry>();
builder.Services.AddSingleton<BridgeStateStore>(services =>
    new BridgeStateStore(
        services.GetRequiredService<TrackSessionCoordinator>().Current,
        services.GetRequiredService<SseClientRegistry>()));
builder.Services.AddHostedService<BridgeBackgroundService>();

var app = builder.Build();

app.MapGet("/v1/snapshot", (BridgeStateStore store) =>
    Results.Json(store.Current));

app.MapGet("/v1/events", async (
    HttpContext context,
    BridgeStateStore store,
    SseClientRegistry clients) =>
{
    context.Response.ContentType = "text/event-stream";
    context.Response.Headers.CacheControl = "no-cache";
    context.Response.Headers.Connection = "keep-alive";

    using var subscription = clients.Subscribe();
    try
    {
        await context.Response.StartAsync(context.RequestAborted);
        await SseWriter.WriteAsync(context.Response, store.Current, context.RequestAborted);

        await foreach (var snapshot in subscription.Reader.ReadAllAsync(context.RequestAborted))
        {
            await SseWriter.WriteAsync(context.Response, snapshot, context.RequestAborted);
        }
    }
    catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
    {
        // The client disconnected.
    }
});

app.MapGet("/", () => Results.Text("Netease Lyrics Bridge is running."));

app.Run();

public partial class Program;
