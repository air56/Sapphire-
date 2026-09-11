import test from 'node:test';
import assert from 'node:assert/strict';
import { selectDisplayLines } from '../lyric-view-model.js';

test('selectDisplayLines shows translation only when the current line has one', () => {
  const result = selectDisplayLines([
    { startMs: 1000, original: 'one', translation: null },
    { startMs: 2000, original: 'two', translation: '二' }
  ], 2000, 56);

  assert.deepEqual(result, {
    currentOriginal: 'two',
    currentTranslation: '二',
    nextOriginal: null
  });
});

test('selectDisplayLines truncates without splitting surrogate pairs', () => {
  const result = selectDisplayLines([{ startMs: 0, original: 'A😀BC', translation: null }], 0, 3);
  assert.equal(result.currentOriginal, 'A😀…');
});

test('selectDisplayLines uses the first line as a preview before playback reaches it', () => {
  const result = selectDisplayLines([
    { startMs: 1000, original: 'one', translation: null },
    { startMs: 2000, original: 'two', translation: null }
  ], 0, 56);

  assert.deepEqual(result, {
    currentOriginal: null,
    currentTranslation: null,
    nextOriginal: 'one'
  });
});
