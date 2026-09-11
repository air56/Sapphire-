import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, saveSettings, SETTINGS_KEY } from '../settings.js';

test('normalizeSettings clamps and preserves supported user preferences', () => {
  assert.deepEqual(normalizeSettings({ fontSize: 99, maxChars: 9, color: '#123456' }), {
    fontSize: 48,
    maxChars: 20,
    color: '#123456'
  });
});

test('saveSettings persists normalized values and rejects named colors', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };

  const saved = saveSettings({ fontSize: 99, maxChars: 9, color: 'red' }, storage);

  assert.deepEqual(saved, { fontSize: 48, maxChars: 20, color: '#F7FBFF' });
  assert.deepEqual(JSON.parse(values.get(SETTINGS_KEY)), saved);
});
