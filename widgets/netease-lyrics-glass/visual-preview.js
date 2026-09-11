export const DEFAULT_VISUAL_PREVIEW = Object.freeze({
  width: 640,
  height: 180,
  fontSize: 34,
  translationSize: 17,
  opacity: 1,
  shadow: 0.45,
  gap: 8,
  color: '#F7FBFF',
  translationColor: '#D9E5F7',
  background: 'transparent',
  style: 'transparent-shadow',
  zhFont: 'system-ui',
  jaFont: 'system-ui',
  latinFont: 'system-ui',
  translationVisible: true
});

const VISUAL_STYLES = Object.freeze([
  { id: 'transparent-shadow', name: '清晰阴影', background: 'transparent', shadow: 0.45, glow: 0.14 },
  { id: 'transparent-glow', name: '柔和光晕', background: 'transparent', shadow: 0.26, glow: 0.32 },
  { id: 'transparent-soft', name: '低干扰', background: 'transparent', shadow: 0.2, glow: 0.08 }
]);

const FONT_OPTIONS = Object.freeze({
  zh: [
    { value: 'system-ui', label: '系统无衬线' },
    { value: '"Microsoft YaHei", system-ui', label: '微软雅黑' },
    { value: '"Noto Sans SC", system-ui', label: 'Noto Sans SC（预览）' },
    { value: '"Source Han Sans SC", system-ui', label: '思源黑体（预览）' }
  ],
  ja: [
    { value: 'system-ui', label: '系统日文字体' },
    { value: '"Yu Gothic UI", system-ui', label: '游ゴシック UI' },
    { value: '"Noto Sans JP", system-ui', label: 'Noto Sans JP（预览）' },
    { value: '"Source Han Sans JP", system-ui', label: '思源黑体 JP（预览）' }
  ],
  latin: [
    { value: 'system-ui', label: '系统无衬线' },
    { value: '"Aptos", system-ui', label: 'Aptos' },
    { value: '"Avenir Next", system-ui', label: 'Avenir Next（预览）' },
    { value: '"Atkinson Hyperlegible", system-ui', label: 'Atkinson（预览）' }
  ]
});

function clamp(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function normalizeFont(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function normalizeVisualPreview(input = {}) {
  const style = VISUAL_STYLES.some((item) => item.id === input.style) ? input.style : DEFAULT_VISUAL_PREVIEW.style;
  const styleDefaults = VISUAL_STYLES.find((item) => item.id === style);
  return {
    ...DEFAULT_VISUAL_PREVIEW,
    ...input,
    width: Math.round(clamp(input.width, 160, 960, DEFAULT_VISUAL_PREVIEW.width)),
    height: Math.round(clamp(input.height, 96, 420, DEFAULT_VISUAL_PREVIEW.height)),
    fontSize: Math.round(clamp(input.fontSize, 16, 64, DEFAULT_VISUAL_PREVIEW.fontSize)),
    translationSize: Math.round(clamp(input.translationSize, 10, 36, DEFAULT_VISUAL_PREVIEW.translationSize)),
    opacity: clamp(input.opacity, 0.35, 1, DEFAULT_VISUAL_PREVIEW.opacity),
    shadow: clamp(input.shadow, 0, 1, styleDefaults.shadow),
    gap: Math.round(clamp(input.gap, 0, 24, DEFAULT_VISUAL_PREVIEW.gap)),
    background: 'transparent',
    style,
    zhFont: normalizeFont(input.zhFont, DEFAULT_VISUAL_PREVIEW.zhFont),
    jaFont: normalizeFont(input.jaFont, DEFAULT_VISUAL_PREVIEW.jaFont),
    latinFont: normalizeFont(input.latinFont, DEFAULT_VISUAL_PREVIEW.latinFont),
    translationVisible: input.translationVisible !== false
  };
}

export function createPreviewMessage(input = {}) {
  const settings = normalizeVisualPreview(input);
  return {
    type: 'netease-lyrics-visual-preview',
    settings: {
      ...settings,
      style: settings.style,
      background: 'transparent'
    }
  };
}

export function serializeSelection(input = {}) {
  const settings = normalizeVisualPreview(input);
  return {
    style: settings.style,
    zhFont: settings.zhFont,
    jaFont: settings.jaFont,
    latinFont: settings.latinFont
  };
}

export function listVisualStyles() {
  return VISUAL_STYLES.map((style) => ({ ...style }));
}

export function listFontOptions(language) {
  return (FONT_OPTIONS[language] ?? []).map((item) => ({ ...item }));
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = String(value);
}

function updateSelectionLabel(selection) {
  const target = document.getElementById('selection-summary');
  if (!target) return;
  target.textContent = `已选择：${selection.style} · 中文 ${selection.zhFont} · 日文 ${selection.jaFont} · 英文 ${selection.latinFont}`;
}

function renderFontOptions(id, language, selected) {
  const select = document.getElementById(id);
  if (!select) return;
  select.replaceChildren(...listFontOptions(language).map((option) => {
    const element = document.createElement('option');
    element.value = option.value;
    element.textContent = option.label;
    element.selected = option.value === selected;
    return element;
  }));
}

export function mountVisualPreviewPage(root = document) {
  const frame = root.getElementById('lyrics-preview-frame');
  if (!frame) return null;
  let state = normalizeVisualPreview();
  renderFontOptions('font-zh', 'zh', state.zhFont);
  renderFontOptions('font-ja', 'ja', state.jaFont);
  renderFontOptions('font-latin', 'latin', state.latinFont);

  const send = () => {
    state = normalizeVisualPreview(state);
    setValue('width-input', state.width);
    setValue('height-input', state.height);
    setValue('font-size-input', state.fontSize);
    setValue('translation-size-input', state.translationSize);
    setValue('opacity-input', state.opacity);
    setValue('shadow-input', state.shadow);
    setValue('gap-input', state.gap);
    frame.style.width = `${state.width}px`;
    frame.style.height = `${state.height}px`;
    frame.contentWindow?.postMessage(createPreviewMessage(state), '*');
  };

  const patch = (name, value) => {
    state = normalizeVisualPreview({ ...state, [name]: value });
    send();
  };

  const bindings = [
    ['width-input', 'width'], ['height-input', 'height'], ['font-size-input', 'fontSize'],
    ['translation-size-input', 'translationSize'], ['opacity-input', 'opacity'], ['shadow-input', 'shadow'], ['gap-input', 'gap'],
    ['font-zh', 'zhFont'], ['font-ja', 'jaFont'], ['font-latin', 'latinFont']
  ];
  for (const [id, key] of bindings) {
    root.getElementById(id)?.addEventListener('input', (event) => patch(key, event.target.value));
    root.getElementById(id)?.addEventListener('change', (event) => patch(key, event.target.value));
  }
  root.getElementById('translation-toggle')?.addEventListener('change', (event) => patch('translationVisible', event.target.checked));
  for (const style of VISUAL_STYLES) {
    root.getElementById(`style-${style.id}`)?.addEventListener('click', () => patch('style', style.id));
  }
  root.getElementById('select-style-button')?.addEventListener('click', () => updateSelectionLabel(serializeSelection(state)));
  frame.addEventListener('load', send);
  send();
  updateSelectionLabel(serializeSelection(state));
  return { getState: () => ({ ...state }), send };
}

if (typeof document !== 'undefined' && document.getElementById('lyrics-preview-frame')) {
  mountVisualPreviewPage(document);
}
