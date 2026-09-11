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

export function normalizeSettings(input = {}) {
  return {
    fontSize: clampInteger(input.fontSize, 16, 48, DEFAULT_SETTINGS.fontSize),
    maxChars: clampInteger(input.maxChars, 20, 180, DEFAULT_SETTINGS.maxChars),
    color: normalizeColor(input.color)
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
