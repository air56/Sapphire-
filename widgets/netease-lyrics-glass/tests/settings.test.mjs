import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings } from '../settings.js';

test('normalizeSettings clamps and preserves supported user preferences', () => {
  assert.deepEqual(normalizeSettings({ fontSize: 99, maxChars: 9, color: '#123456' }), {
    fontSize: 48,
    maxChars: 20,
    color: '#123456'
  });
});
