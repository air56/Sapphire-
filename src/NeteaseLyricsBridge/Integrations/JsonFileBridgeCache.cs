using System.Text.Json;
using NeteaseLyricsBridge.Contracts;
using NeteaseLyricsBridge.Core;

namespace NeteaseLyricsBridge.Integrations;

public sealed class JsonFileBridgeCache : IBridgeCache
{
    private static readonly TimeSpan EntryLifetime = TimeSpan.FromDays(30);
    private const int MaximumEntryCount = 500;

    private readonly string _filePath;
    private readonly TimeProvider _clock;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public JsonFileBridgeCache(string filePath, TimeProvider? clock = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(filePath);
        _filePath = filePath;
        _clock = clock ?? TimeProvider.System;
    }

    public async Task<LyricsLookupResult?> GetAsync(TrackIdentity identity, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(identity);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var cache = await LoadAsync(cancellationToken);
            var now = _clock.GetUtcNow();
            var changed = RemoveExpired(cache, now);

            if (!cache.Entries.TryGetValue(identity.CacheKey, out var entry))
            {
                if (changed)
                {
                    await SaveAsync(cache, cancellationToken);
                }

                return null;
            }

            entry.LastAccessedAt = now;
            await SaveAsync(cache, cancellationToken);
            return entry.Result;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task SetAsync(TrackIdentity identity, LyricsLookupResult result, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(identity);
        ArgumentNullException.ThrowIfNull(result);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var cache = await LoadAsync(cancellationToken);
            var now = _clock.GetUtcNow();
            RemoveExpired(cache, now);
            cache.Entries[identity.CacheKey] = new CacheEntry
            {
                Result = result,
                CreatedAt = now,
                LastAccessedAt = now
            };

            foreach (var key in cache.Entries
                         .OrderBy(entry => entry.Value.LastAccessedAt)
                         .Take(Math.Max(0, cache.Entries.Count - MaximumEntryCount))
                         .Select(entry => entry.Key)
                         .ToArray())
            {
                cache.Entries.Remove(key);
            }

            await SaveAsync(cache, cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<CacheDocument> LoadAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_filePath))
        {
            return new CacheDocument();
        }

        try
        {
            await using var stream = File.OpenRead(_filePath);
            return await JsonSerializer.DeserializeAsync<CacheDocument>(stream, cancellationToken: cancellationToken)
                ?? new CacheDocument();
        }
        catch (JsonException)
        {
            File.Delete(_filePath);
            return new CacheDocument();
        }
    }

    private async Task SaveAsync(CacheDocument cache, CancellationToken cancellationToken)
    {
        var directory = Path.GetDirectoryName(_filePath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var tempPath = $"{_filePath}.{Guid.NewGuid():N}.tmp";
        try
        {
            await using (var stream = File.Create(tempPath))
            {
                await JsonSerializer.SerializeAsync(stream, cache, cancellationToken: cancellationToken);
            }

            File.Move(tempPath, _filePath, overwrite: true);
        }
        finally
        {
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }
        }
    }

    private static bool RemoveExpired(CacheDocument cache, DateTimeOffset now)
    {
        var expiredKeys = cache.Entries
            .Where(entry => now - entry.Value.CreatedAt > EntryLifetime)
            .Select(entry => entry.Key)
            .ToArray();

        foreach (var key in expiredKeys)
        {
            cache.Entries.Remove(key);
        }

        return expiredKeys.Length > 0;
    }

    private sealed class CacheDocument
    {
        public Dictionary<string, CacheEntry> Entries { get; init; } = new(StringComparer.Ordinal);
    }

    private sealed class CacheEntry
    {
        public LyricsLookupResult Result { get; init; } = new("unavailable", [], null);

        public DateTimeOffset CreatedAt { get; init; }

        public DateTimeOffset LastAccessedAt { get; set; }
    }
}
