function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function trimmedString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function nonNegativeMs(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function toPlaybackState(value) {
  // Sapphire's QML-facing SMTC status is localized (for example, "播放中")
  // while some builds expose the English or numeric enum value. Normalize all
  // known representations before sending the update to the bridge.
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === 0) return 'Playing';
    if (value === 1) return 'Paused';
    return 'Stopped';
  }

  const normalized = String(value ?? '').trim().toLowerCase();
  if (['playing', 'play', '播放中', '正在播放', '播放'].includes(normalized)) {
    return 'Playing';
  }
  if (['paused', 'pause', '已暂停', '暂停播放', '暂停'].includes(normalized)) {
    return 'Paused';
  }
  return 'Stopped';
}

function artistsFrom(value) {
  const artist = trimmedString(value);
  if (!artist) return [];

  return artist
    .split(/\s*(?:\/|、|;|；)\s*/u)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function isNeteaseApplicationName(value) {
  const applicationName = trimmedString(value);
  return applicationName !== null && /netease|cloudmusic|网易云/ui.test(applicationName);
}

function createUpdateFromValues(media, playback, now = new Date()) {
  if (!media || media.enabled === false || playback.enabled === false) return null;

  const sourceAppUserModelId = trimmedString(media.appName);
  const title = trimmedString(media.mediaTitle);
  if (!sourceAppUserModelId || !title || !isNeteaseApplicationName(sourceAppUserModelId)) return null;

  const timestamp = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(timestamp.getTime())) return null;

  return {
    sourceAppUserModelId,
    title,
    artists: artistsFrom(media.mediaArtist),
    album: trimmedString(media.mediaAlbum),
    durationMs: nonNegativeMs(playback.playbackDuration),
    state: toPlaybackState(playback.playbackStatus),
    positionMs: nonNegativeMs(playback.playbackPosition),
    updatedAt: timestamp.toISOString()
  };
}

export function createSapphireSmtcUpdate(mediaJson, playbackJson, now = new Date()) {
  const media = parseJsonObject(mediaJson);
  // Sapphire may publish the media property before the playback property finishes
  // initializing. Media metadata is sufficient to start a lyrics lookup; a later
  // playback signal will refine timeline and state.
  const playback = parseJsonObject(playbackJson) ?? { enabled: true };
  return createUpdateFromValues(media, playback, now);
}

export function createSapphireSmtcUpdateFromBridge(bridge, now = new Date()) {
  if (!bridge || typeof bridge !== 'object') return null;

  // Older Sapphire builds exposed two JSON strings. Current SWidget.qml exposes
  // the same data as separate Q_PROPERTY values, so use the JSON values as a
  // base and fill any missing fields from the direct properties.
  const mediaJson = parseJsonObject(bridge.smtcMediaInfo) ?? {};
  const playbackJson = parseJsonObject(bridge.smtcPlaybackStatus) ?? {};
  const media = {
    ...mediaJson,
    appName: trimmedString(mediaJson.appName) ?? trimmedString(bridge.smtcAppName),
    mediaTitle: trimmedString(mediaJson.mediaTitle) ?? trimmedString(bridge.smtcMediaTitle),
    mediaArtist: trimmedString(mediaJson.mediaArtist) ?? trimmedString(bridge.smtcMediaArtist),
    mediaAlbum: trimmedString(mediaJson.mediaAlbum) ?? trimmedString(bridge.smtcMediaAlbum)
  };
  const playback = {
    ...playbackJson,
    playbackStatus: playbackJson.playbackStatus ?? bridge.smtcPlaybackStatus,
    playbackPosition: playbackJson.playbackPosition ?? bridge.smtcPlaybackPosition,
    playbackDuration: playbackJson.playbackDuration ?? bridge.smtcPlaybackDuration
  };

  return createUpdateFromValues(media, playback, now);
}

function connectSignal(signal, handler) {
  if (signal && typeof signal.connect === 'function') {
    signal.connect(handler);
    return true;
  }

  return false;
}

export function startSapphireSmtc(onUpdate, runtime = globalThis) {
  if (typeof onUpdate !== 'function') throw new TypeError('onUpdate must be a function');

  const qt = runtime?.qt;
  const QWebChannel = runtime?.QWebChannel;
  if (!qt?.webChannelTransport || typeof QWebChannel !== 'function') {
    return { connected: false, dispose() {} };
  }

  let disposed = false;
  let pollHandle = null;
  const emit = () => {
    if (disposed) return;
    const bridge = currentBridge;
    const update = createSapphireSmtcUpdateFromBridge(bridge);
    if (update) void Promise.resolve(onUpdate(update)).catch(() => {});
  };
  let currentBridge = null;

  new QWebChannel(qt.webChannelTransport, (channel) => {
    if (disposed) return;
    currentBridge = channel?.objects?.bridge ?? null;
    if (!currentBridge) return;

    [
      'smtcMediaInfoChanged',
      'smtcMediaTitleChanged',
      'smtcMediaArtistChanged',
      'smtcMediaAlbumChanged',
      'smtcAppNameChanged',
      'smtcPlaybackStatusChanged',
      'smtcPlaybackPositionChanged',
      'smtcPlaybackDurationChanged'
    ].forEach((signalName) => connectSignal(currentBridge[signalName], emit));

    // Sapphire's official WebChannel sample defers its first reactive property
    // read, because the C++ side can finish filling these properties just after
    // the QWebChannel callback runs.
    const schedule = typeof runtime?.setTimeout === 'function'
      ? runtime.setTimeout.bind(runtime)
      : setTimeout;
    schedule(emit, 200);

    // Some Sapphire builds update the WebChannel properties without emitting
    // a change signal for every timeline tick. Poll the cached reactive values
    // so play/pause/position changes still reach the bridge.
    const setIntervalFn = typeof runtime?.setInterval === 'function'
      ? runtime.setInterval.bind(runtime)
      : (typeof setInterval === 'function' ? setInterval : null);
    if (setIntervalFn) pollHandle = setIntervalFn(emit, 250);
  });

  return {
    connected: true,
    dispose() {
      disposed = true;
      const clearIntervalFn = typeof runtime?.clearInterval === 'function'
        ? runtime.clearInterval.bind(runtime)
        : (typeof clearInterval === 'function' ? clearInterval : null);
      if (pollHandle !== null && clearIntervalFn) clearIntervalFn(pollHandle);
      pollHandle = null;
      currentBridge = null;
    }
  };
}
