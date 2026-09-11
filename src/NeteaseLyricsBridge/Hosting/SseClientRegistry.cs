using System.Collections.Concurrent;
using System.Threading.Channels;
using NeteaseLyricsBridge.Contracts;

namespace NeteaseLyricsBridge.Hosting;

public sealed class SseClientRegistry
{
    private readonly ConcurrentDictionary<Guid, Channel<BridgeSnapshot>> _clients = new();

    public SseSubscription Subscribe()
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateBounded<BridgeSnapshot>(new BoundedChannelOptions(8)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false
        });
        _clients[id] = channel;
        return new SseSubscription(id, channel, this);
    }

    public ValueTask BroadcastAsync(BridgeSnapshot snapshot)
    {
        foreach (var channel in _clients.Values)
        {
            channel.Writer.TryWrite(snapshot);
        }

        return ValueTask.CompletedTask;
    }

    private void Remove(Guid id, Channel<BridgeSnapshot> channel)
    {
        if (_clients.TryRemove(new KeyValuePair<Guid, Channel<BridgeSnapshot>>(id, channel)))
        {
            channel.Writer.TryComplete();
        }
    }

    public sealed class SseSubscription : IDisposable
    {
        private readonly Guid _id;
        private readonly Channel<BridgeSnapshot> _channel;
        private readonly SseClientRegistry _owner;
        private int _disposed;

        internal SseSubscription(Guid id, Channel<BridgeSnapshot> channel, SseClientRegistry owner)
        {
            _id = id;
            _channel = channel;
            _owner = owner;
        }

        public ChannelReader<BridgeSnapshot> Reader => _channel.Reader;

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _disposed, 1) == 0)
            {
                _owner.Remove(_id, _channel);
            }
        }
    }
}
