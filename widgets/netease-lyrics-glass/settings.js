export const SETTINGS_KEY = 'neteaseLyricsGlass.settings.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  fontSize: 37,
  maxChars: 56,
  color: '#F7FBFF',
  translationSize: 16,
  translationGap: 9,
  zhFont: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
  jaFont: '"Yu Gothic UI", "Noto Sans JP", sans-serif',
  latinFont: '"Atkinson Hyperlegible", "Aptos", sans-serif',
  textShadowStrength: 0.2,
  textGlowStrength: 0.08,
  background: 'transparent'
});

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function getDefaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function normalizeColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : DEFAULT_SETTINGS.color;
}

function normalizeFont(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function normalizeSettings(input = {}) {
  return {
    fontSize: clampInteger(input.fontSize, 16, 48, DEFAULT_SETTINGS.fontSize),
    maxChars: clampInteger(input.maxChars, 20, 180, DEFAULT_SETTINGS.maxChars),
    color: normalizeColor(input.color),
    translationSize: clampInteger(input.translationSize, 10, 36, DEFAULT_SETTINGS.translationSize),
    translationGap: clampInteger(input.translationGap, 0, 24, DEFAULT_SETTINGS.translationGap),
    zhFont: normalizeFont(input.zhFont, DEFAULT_SETTINGS.zhFont),
    jaFont: normalizeFont(input.jaFont, DEFAULT_SETTINGS.jaFont),
    latinFont: normalizeFont(input.latinFont, DEFAULT_SETTINGS.latinFont),
    textShadowStrength: clampNumber(input.textShadowStrength, 0, 1, DEFAULT_SETTINGS.textShadowStrength),
    textGlowStrength: clampNumber(input.textGlowStrength, 0, 1, DEFAULT_SETTINGS.textGlowStrength),
    background: 'transparent'
  };
}

export function loadSettings(storage = getDefaultStorage()) {
  try {
    if (!storage || typeof storage.getItem !== 'function') return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(next, storage = getDefaultStorage()) {
  const normalized = normalizeSettings(next);
  try {
    if (storage && typeof storage.setItem === 'function') {
      storage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    }
  } catch {
    // Sapphire may expose an opaque WebEngine origin without writable storage.
  }
  return normalized;
}
