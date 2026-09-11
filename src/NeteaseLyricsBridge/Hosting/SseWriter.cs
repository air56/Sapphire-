using Microsoft.AspNetCore.Http;
using NeteaseLyricsBridge.Contracts;

namespace NeteaseLyricsBridge.Hosting;

public static class SseWriter
{
    public static async Task WriteAsync(HttpResponse response, BridgeSnapshot snapshot, CancellationToken cancellationToken)
    {
        await response.WriteAsync("event: snapshot\ndata: ", cancellationToken);
        await response.WriteAsync(BridgeStateStore.Serialize(snapshot), cancellationToken);
        await response.WriteAsync("\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }
}
