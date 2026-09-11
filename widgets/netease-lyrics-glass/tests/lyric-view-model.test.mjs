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

test('selectDisplayLines returns fixed-height lyric slots for translated and untranslated lines', () => {
  const result = selectDisplayLines([
    { startMs: 0, original: 'もう一度だけ', translation: '再一次就好' },
    { startMs: 5000, original: '下一句没有翻译', translation: null }
  ], 0, 56);

  assert.deepEqual(result.currentSlot, {
    original: 'もう一度だけ',
    translation: '再一次就好',
    hasTranslation: true,
    slotKey: 'current-0'
  });
  assert.deepEqual(result.nextSlot, {
    original: '下一句没有翻译',
    translation: null,
    hasTranslation: false,
    slotKey: 'next-1'
  });
});

test('selectDisplayLines preserves next slot identity when translation is toggled', () => {
  const withoutTranslation = selectDisplayLines([
    { startMs: 0, original: 'line', translation: null },
    { startMs: 5000, original: 'next', translation: null }
  ], 0, 56);
  const withTranslation = selectDisplayLines([
    { startMs: 0, original: 'line', translation: '翻译' },
    { startMs: 5000, original: 'next', translation: null }
  ], 0, 56);

  assert.equal(withoutTranslation.nextSlot.slotKey, withTranslation.nextSlot.slotKey);
});
