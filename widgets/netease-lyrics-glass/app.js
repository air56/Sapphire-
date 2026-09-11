import { loadSettings, saveSettings } from './settings.js';

const BRIDGE_ORIGIN = 'http://127.0.0.1:18763';
const ids = ['widget-root', 'state-label', 'current-original', 'current-translation', 'next-original', 'settings-toggle', 'settings-panel', 'font-size-input', 'max-chars-input', 'color-input', 'font-size-output', 'max-chars-output'];
const els = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
let settings = loadSettings();
let editMode = false;

function applySettings() {
  document.documentElement.style.setProperty('--font-size', `${settings.fontSize}px`);
  document.documentElement.style.setProperty('--lyrics-color', settings.color);
  els['font-size-input'].value = settings.fontSize;
  els['max-chars-input'].value = settings.maxChars;
  els['color-input'].value = settings.color;
  els['font-size-output'].value = `${settings.fontSize}px`;
  els['font-size-output'].textContent = `${settings.fontSize}px`;
  els['max-chars-output'].value = settings.maxChars;
  els['max-chars-output'].textContent = settings.maxChars;
}
function setState(message, tone = 'idle') { els['state-label'].textContent = message; els['widget-root'].dataset.state = tone; }
function setText(element, value, hidden = false) { element.textContent = value ?? ''; element.hidden = hidden || !value; }
function bindSettings() {
  const update = (patch) => { settings = saveSettings({ ...settings, ...patch }); applySettings(); };
  els['font-size-input'].addEventListener('input', (event) => update({ fontSize: event.target.value }));
  els['max-chars-input'].addEventListener('input', (event) => update({ maxChars: event.target.value }));
  els['color-input'].addEventListener('input', (event) => update({ color: event.target.value }));
  els['settings-toggle'].addEventListener('click', () => {
    if (editMode) return;
    const open = els['settings-panel'].hidden;
    els['settings-panel'].hidden = !open;
    els['settings-toggle'].setAttribute('aria-expanded', String(open));
  });
}
function renderSnapshot(snapshot) {
  const lyrics = snapshot?.lyrics;
  if (!snapshot || !lyrics) { setState('等待歌词桥接服务'); return; }
  const status = String(lyrics.status ?? '').toLowerCase();
  if (status === 'ready' && lyrics.lines?.length) {
    setState('歌词已连接', 'ready');
    const line = lyrics.lines[0];
    setText(els['current-original'], line.original || '');
    setText(els['current-translation'], line.translation || '', !line.translation);
    setText(els['next-original'], lyrics.lines[1]?.original || '', !lyrics.lines[1]?.original);
  } else if (status === 'unavailable') {
    setState('当前歌曲暂无可用歌词', 'warning');
    setText(els['current-original'], '当前歌曲暂无可用歌词');
    setText(els['current-translation'], '', true); setText(els['next-original'], '', true);
  } else {
    setState(snapshot.bridge?.status === 'disconnected' ? '等待歌词桥接服务' : '正在获取歌词', 'loading');
    setText(els['current-original'], snapshot.track ? '正在获取歌词' : '打开网易云并播放歌曲');
    setText(els['current-translation'], '', true); setText(els['next-original'], '', true);
  }
}
function connectBridge() {
  fetch(`${BRIDGE_ORIGIN}/v1/snapshot`, { cache: 'no-store' })
    .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
    .then(renderSnapshot)
    .catch(() => setState('等待歌词桥接服务', 'offline'));
}
function readRuntimeContext() {
  const params = new URLSearchParams(location.search);
  editMode = params.get('edit') === 'true';
  if (editMode) els['settings-toggle'].disabled = true;
}
readRuntimeContext();
applySettings();
bindSettings();
setState('等待歌词桥接服务');
connectBridge();
