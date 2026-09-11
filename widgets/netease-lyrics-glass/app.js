import { loadSettings, saveSettings } from './settings.js';
import { selectDisplayLines } from './lyric-view-model.js';
import { createVisualPreviewSnapshot, getVisualPreviewMode } from './preview-mode.js';
import { selectResponsiveLayout } from './responsive-layout.js';
import { startSapphireSmtc } from './sapphire-smtc.js';
import { createPlaybackClock } from './playback-state.js';

const BRIDGE_ORIGIN = 'http://127.0.0.1:18763';
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];
const ids = ['widget-root', 'state-label', 'current-slot', 'current-original', 'current-translation', 'current-translation-text', 'next-slot', 'next-original', 'next-translation', 'next-translation-text', 'settings-toggle', 'settings-panel', 'settings-close', 'font-size-input', 'max-chars-input', 'color-input', 'font-size-output', 'max-chars-output'];
const els = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

let settings = loadSettings();
let editMode = false;
let bridgeSnapshot = null;
const playbackClock = createPlaybackClock();
let reconnectAttempt = 0;
let reconnectTimer = null;
let eventSource = null;
let connectionGeneration = 0;
let visualPreviewMode = null;

function applySettings() {
  const root = els['widget-root'];
  root.style.setProperty('--lyric-size', `${settings.fontSize}px`);
  root.style.setProperty('--lyric-color', settings.color);
  root.style.setProperty('--translation-size', `${settings.translationSize}px`);
  root.style.setProperty('--translation-gap', `${settings.translationGap}px`);
  root.style.setProperty('--preview-size', `${Math.round(settings.fontSize * 0.56)}px`);
  root.style.setProperty('--font-zh', settings.zhFont);
  root.style.setProperty('--font-ja', settings.jaFont);
  root.style.setProperty('--font-latin', settings.latinFont);
  root.style.setProperty('--text-shadow-strength', String(settings.textShadowStrength));
  root.style.setProperty('--text-glow-strength', String(settings.textGlowStrength));
  els['font-size-input'].value = settings.fontSize;
  els['max-chars-input'].value = settings.maxChars;
  els['color-input'].value = settings.color;
  els['font-size-output'].value = `${settings.fontSize}px`;
  els['font-size-output'].textContent = `${settings.fontSize}px`;
  els['max-chars-output'].value = settings.maxChars;
  els['max-chars-output'].textContent = settings.maxChars;
}

function setState(message, tone = 'idle') {
  els['state-label'].textContent = message;
  els['widget-root'].dataset.state = tone;
}

function setText(element, value, hidden = false) {
  if (!element) return;
  element.textContent = value ?? '';
  element.hidden = hidden || !value;
}

function setSlotEmpty(slot, empty) {
  if (!slot) return;
  slot.dataset.empty = String(empty);
}

function renderScriptText(container, value) {
  if (!container) return;
  container.replaceChildren();
  const text = String(value ?? '');
  const fragment = document.createDocumentFragment();
  let buffer = '';
  let currentScript = null;
  const flush = () => {
    if (!buffer) return;
    const span = document.createElement('span');
    span.className = `script-${currentScript ?? 'zh'}`;
    span.textContent = buffer;
    fragment.appendChild(span);
    buffer = '';
  };
  for (const character of text) {
    const code = character.codePointAt(0);
    const script = /[A-Za-z0-9]/.test(character)
      ? 'latin'
      : ((code >= 0x3040 && code <= 0x30ff) ? 'ja' : 'zh');
    if (script !== currentScript) {
      flush();
      currentScript = script;
    }
    buffer += character;
  }
  flush();
  container.appendChild(fragment);
}

function renderSlot(slot, originalElement, translationElement, original, translation) {
  const hasOriginal = Boolean(String(original ?? '').trim());
  const hasTranslation = Boolean(String(translation ?? '').trim());
  if (originalElement) renderScriptText(originalElement, original);
  else setText(originalElement, original, !hasOriginal);
  const translationText = translationElement?.querySelector('span') ?? translationElement;
  setText(translationText, translation, false);
  if (translationElement) {
    translationElement.dataset.empty = String(!hasTranslation);
    translationElement.setAttribute('aria-hidden', String(!hasTranslation));
  }
  setSlotEmpty(slot, !hasOriginal);
}

function clearLyrics(message = '') {
  renderSlot(els['current-slot'], els['current-original'], els['current-translation'], message, '');
  renderSlot(els['next-slot'], els['next-original'], els['next-translation'], '', '');
}

function applyVisualPreviewMessage(message) {
  if (!message || message.type !== 'netease-lyrics-visual-preview' || window.parent === window) return;
  const next = message.settings ?? {};
  const root = els['widget-root'];
  root.style.setProperty('--font-zh', next.zhFont || 'system-ui');
  root.style.setProperty('--font-ja', next.jaFont || 'system-ui');
  root.style.setProperty('--font-latin', next.latinFont || 'system-ui');
  root.style.setProperty('--lyric-size', `${Number(next.fontSize) || 34}px`);
  root.style.setProperty('--translation-size', `${Number(next.translationSize) || 17}px`);
  root.style.setProperty('--text-shadow-strength', String(Number(next.shadow) || 0));
  root.style.setProperty('--text-glow-strength', String(Number(next.glow) || 0));
  root.style.setProperty('--translation-gap', `${Number(next.gap) || 0}px`);
  root.style.setProperty('--lyric-color', next.color || '#F7FBFF');
  root.dataset.translationVisible = String(next.translationVisible !== false);
  document.querySelectorAll('.current-translation, .next-translation').forEach((element) => {
    element.style.visibility = next.translationVisible === false ? 'hidden' : '';
  });
}
function effectivePositionMs() {
  if (!bridgeSnapshot?.playback) return 0;
  return playbackClock.position(bridgeSnapshot.playback);
}

function renderLyrics() {
  if (!bridgeSnapshot?.lyrics?.lines?.length) return;
  const selected = selectDisplayLines(bridgeSnapshot.lyrics.lines, effectivePositionMs(), settings.maxChars);
  renderSlot(els['current-slot'], els['current-original'], els['current-translation'], selected.currentSlot?.original ?? selected.currentOriginal, selected.currentSlot?.translation ?? selected.currentTranslation);
  renderSlot(els['next-slot'], els['next-original'], els['next-translation'], selected.nextSlot?.original ?? selected.nextOriginal, selected.nextSlot?.translation ?? '');
}

function renderSnapshot(snapshot) {
  if (!snapshot) {
    bridgeSnapshot = null;
    playbackClock.reset();
    setState('尚未连接歌词服务', 'offline');
    clearLyrics('启动 Lyrics Bridge 后自动识别');
    return;
  }

  const previousSessionId = bridgeSnapshot?.trackSessionId;
  const isNewSession = previousSessionId && previousSessionId !== snapshot.trackSessionId;
  bridgeSnapshot = snapshot;
  playbackClock.update(snapshot.trackSessionId, snapshot.playback);

  if (isNewSession) clearLyrics('正在获取歌词');

  const lyricsStatus = String(snapshot.lyrics?.status ?? '').toLowerCase();
  const bridgeStatus = String(snapshot.bridge?.status ?? '').toLowerCase();
  if (lyricsStatus === 'ready' && snapshot.lyrics.lines?.length) {
    setState('歌词已连接', 'ready');
    renderLyrics();
  } else if (lyricsStatus === 'unavailable') {
    const message = bridgeStatus === 'waitingforplayer' || !snapshot.track
      ? '打开网易云并播放歌曲'
      : '当前歌曲暂无可用歌词';
    setState(message, bridgeStatus === 'waitingforplayer' ? 'idle' : 'warning');
    clearLyrics(message);
  } else if (lyricsStatus === 'error' || bridgeStatus === 'error') {
    setState('歌词暂时不可用', 'error');
    clearLyrics('歌词暂时不可用');
  } else {
    setState('正在获取歌词', 'loading');
    if (!isNewSession) clearLyrics(snapshot.track ? '正在获取歌词' : '打开网易云并播放歌曲');
  }
}

async function fetchSnapshot() {
  const response = await fetch(`${BRIDGE_ORIGIN}/v1/snapshot`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`snapshot HTTP ${response.status}`);
  return response.json();
}

function scheduleReconnect(generation) {
  if (generation !== connectionGeneration) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectBridge(generation);
  }, delay);
}

function closeEventSource() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

async function connectBridge(generation = connectionGeneration) {
  if (generation !== connectionGeneration) return;
  closeEventSource();
  try {
    renderSnapshot(await fetchSnapshot());
    if (generation !== connectionGeneration) return;
    const source = new EventSource(`${BRIDGE_ORIGIN}/v1/events`);
    eventSource = source;
    source.addEventListener('snapshot', (event) => {
      try { renderSnapshot(JSON.parse(event.data)); } catch { setState('歌词暂时不可用', 'error'); }
    });
    source.onerror = () => {
      if (eventSource !== source) return;
      closeEventSource();
      setState('尚未连接歌词服务', 'offline');
      scheduleReconnect(generation);
    };
    source.onopen = () => { reconnectAttempt = 0; };
  } catch {
    setState('尚未连接歌词服务', 'offline');
    clearLyrics('启动 Lyrics Bridge 后自动识别');
    scheduleReconnect(generation);
  }
}

function bindSettings() {
  const update = (patch) => { settings = saveSettings({ ...settings, ...patch }); applySettings(); renderLyrics(); };
  els['font-size-input'].addEventListener('input', (event) => update({ fontSize: event.target.value }));
  els['max-chars-input'].addEventListener('input', (event) => update({ maxChars: event.target.value }));
  els['color-input'].addEventListener('input', (event) => update({ color: event.target.value }));
  els['settings-toggle'].addEventListener('click', () => {
    if (editMode) return;
    const open = els['settings-panel'].hidden;
    els['settings-panel'].hidden = !open;
    els['settings-toggle'].setAttribute('aria-expanded', String(open));
  });
  els['settings-close'].addEventListener('click', () => {
    els['settings-panel'].hidden = true;
    els['settings-toggle'].setAttribute('aria-expanded', 'false');
    els['settings-toggle'].focus();
  });
}

function readRuntimeContext() {
  const params = new URLSearchParams(location.search);
  editMode = params.get('edit') === 'true' || params.get('editing') === 'true';
  visualPreviewMode = getVisualPreviewMode(location.search, document.referrer, window.top !== window.self);
  if (editMode) {
    els['settings-panel'].hidden = true;
    els['settings-toggle'].setAttribute('aria-expanded', 'false');
    els['settings-toggle'].disabled = true;
  }
}

function updateResponsiveLayout(width, height) {
  const rect = els['widget-root'].getBoundingClientRect();
  els['widget-root'].dataset.layout = selectResponsiveLayout(width ?? rect.width, height ?? rect.height);
}

function bindRuntimeContext() {
  window.addEventListener('message', (event) => applyVisualPreviewMessage(event.data));
  window.addEventListener('sapphire-context', (event) => {
    const context = event.detail ?? {};
    if (typeof context.theme === 'string') els['widget-root'].dataset.theme = context.theme;
    if (context.editing === true || context.editMode === true) {
      editMode = true;
      els['settings-panel'].hidden = true;
      els['settings-toggle'].setAttribute('aria-expanded', 'false');
      els['settings-toggle'].disabled = true;
    }
  });
  const observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.target?.getBoundingClientRect();
    updateResponsiveLayout(rect?.width, rect?.height);
  });
  observer.observe(els['widget-root']);
  updateResponsiveLayout();
}
async function forwardSapphireUpdate(update) {
  try {
    const response = await fetch(`${BRIDGE_ORIGIN}/v1/smtc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    });
    if (!response.ok) console.debug('Sapphire SMTC update rejected', response.status);
  } catch (error) {
    console.debug('Sapphire SMTC bridge fallback active', error);
  }
}

function startSapphireMediaRecognition() {
  // Let Sapphire inject qt.webChannelTransport before constructing QWebChannel.
  // This matches the timing used by Sapphire's official WebChannel example.
  window.setTimeout(() => startSapphireSmtc((update) => forwardSapphireUpdate(update)), 100);
}

function startPositionTicker() {
  const tick = () => {
    if (bridgeSnapshot?.lyrics?.status === 'ready') renderLyrics();
    window.setTimeout(tick, 100);
  };
  tick();
}

readRuntimeContext();
applySettings();
bindSettings();
bindRuntimeContext();
startSapphireMediaRecognition();
setState('正在连接歌词服务');
startPositionTicker();
const visualPreviewSnapshot = createVisualPreviewSnapshot(visualPreviewMode);
if (visualPreviewSnapshot) {
  renderSnapshot(visualPreviewSnapshot);
} else {
  connectionGeneration += 1;
  connectBridge(connectionGeneration);
}

