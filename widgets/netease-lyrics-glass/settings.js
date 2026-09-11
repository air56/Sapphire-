export const SETTINGS_KEY = 'neteaseLyricsGlass.settings.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  fontSize: 26,
  maxChars: 56,
  color: '#F7FBFF'
});

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function normalizeColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : DEFAULT_SETTINGS.color;
}

export function normalizeSettings(input = {}) {
  return {
    fontSize: clampInteger(input.fontSize, 16, 48, DEFAULT_SETTINGS.fontSize),
    maxChars: clampInteger(input.maxChars, 20, 180, DEFAULT_SETTINGS.maxChars),
    color: normalizeColor(input.color)
  };
}

export function loadSettings(storage = globalThis.localStorage) {
  try {
    return normalizeSettings(JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(next, storage = globalThis.localStorage) {
  const normalized = normalizeSettings(next);
  storage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}
