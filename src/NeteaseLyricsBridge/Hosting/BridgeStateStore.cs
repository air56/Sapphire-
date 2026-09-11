using System.Text.Json;
using NeteaseLyricsBridge.Contracts;

namespace NeteaseLyricsBridge.Hosting;

public sealed class BridgeStateStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly object _sync = new();
    private readonly SseClientRegistry _clients;
    private BridgeSnapshot _current;

    public BridgeStateStore(BridgeSnapshot initial, SseClientRegistry clients)
    {
        _current = initial ?? throw new ArgumentNullException(nameof(initial));
        _clients = clients ?? throw new ArgumentNullException(nameof(clients));
    }

    public BridgeSnapshot Current
    {
        get
        {
            lock (_sync)
            {
                return _current;
            }
        }
    }

    public async ValueTask PublishAsync(BridgeSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        lock (_sync)
        {
            _current = snapshot;
        }

        await _clients.BroadcastAsync(snapshot);
    }

    internal static string Serialize(BridgeSnapshot snapshot) =>
        JsonSerializer.Serialize(snapshot, JsonOptions);
}
