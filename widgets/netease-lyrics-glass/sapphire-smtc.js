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
  switch (String(value ?? '').trim().toLowerCase()) {
    case 'playing':
      return 'Playing';
    case 'paused':
      return 'Paused';
    default:
      return 'Stopped';
  }
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

export function createSapphireSmtcUpdate(mediaJson, playbackJson, now = new Date()) {
  const media = parseJsonObject(mediaJson);
  const playback = parseJsonObject(playbackJson);
  if (!media || !playback || media.enabled === false || playback.enabled === false) return null;

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
  const emit = () => {
    if (disposed) return;
    const bridge = currentBridge;
    const update = createSapphireSmtcUpdate(bridge?.smtcMediaInfo, bridge?.smtcPlaybackStatus);
    if (update) void Promise.resolve(onUpdate(update)).catch(() => {});
  };
  let currentBridge = null;

  new QWebChannel(qt.webChannelTransport, (channel) => {
    if (disposed) return;
    currentBridge = channel?.objects?.bridge ?? null;
    if (!currentBridge) return;

    connectSignal(currentBridge.smtcMediaInfoChanged, emit);
    connectSignal(currentBridge.smtcPlaybackStatusChanged, emit);
    emit();
  });

  return {
    connected: true,
    dispose() {
      disposed = true;
      currentBridge = null;
    }
  };
}
