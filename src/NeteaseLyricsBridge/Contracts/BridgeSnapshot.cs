namespace NeteaseLyricsBridge.Contracts;

public sealed record TrackDto(
    string Title,
    IReadOnlyList<string> Artists,
    string? Album,
    string? Artwork,
    long DurationMs);

public sealed record PlaybackDto(
    PlaybackState State,
    long PositionMs,
    DateTimeOffset UpdatedAt);

public sealed record LyricsDto(
    string Status,
    IReadOnlyList<LyricLine> Lines);

public sealed record BridgeDto(
    string Status,
    string? ErrorCode);

public sealed record BridgeSnapshot(
    string TrackSessionId,
    TrackDto? Track,
    PlaybackDto Playback,
    LyricsDto Lyrics,
    BridgeDto Bridge);
