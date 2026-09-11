import test from 'node:test';
import assert from 'node:assert/strict';
import { effectivePlaybackPositionMs, isPlayingState, createPlaybackClock } from '../playback-state.js';
import { selectDisplayLines } from '../lyric-view-model.js';

test('recognizes Sapphire numeric and named playing states', () => {
  assert.equal(isPlayingState(0), true);
  assert.equal(isPlayingState('0'), true);
  assert.equal(isPlayingState('Playing'), true);
  assert.equal(isPlayingState('play'), true);
});

test('does not advance paused or stopped playback', () => {
  assert.equal(isPlayingState(1), false);
  assert.equal(isPlayingState(2), false);
  assert.equal(isPlayingState('Paused'), false);
  assert.equal(isPlayingState('Stopped'), false);
});

test('advances a numeric playing snapshot between bridge updates', () => {
  const position = effectivePlaybackPositionMs(
    { state: 0, positionMs: 12000 },
    { monotonicMs: 1000 },
    1600
  );

  assert.equal(position, 12600);
});

test('advanced position moves the selected lyric line instead of staying on metadata', () => {
  const position = effectivePlaybackPositionMs(
    { state: 0, positionMs: 0 },
    { monotonicMs: 1000 },
    3500
  );
  const selected = selectDisplayLines([
    { startMs: 0, original: '作词、作曲、编曲', translation: null },
    { startMs: 2000, original: '正式歌词第一句', translation: '中文翻译' }
  ], position, 56);

  assert.equal(selected.currentOriginal, '正式歌词第一句');
  assert.equal(selected.currentTranslation, '中文翻译');
});

test('keeps advancing when playing snapshots repeat the same stale position', () => {
  const clock = createPlaybackClock();
  clock.update('song-1', { state: 1, positionMs: 12000 }, 1000);
  clock.update('song-1', { state: 0, positionMs: 12000 }, 2000);
  clock.update('song-1', { state: 0, positionMs: 12000 }, 3000);

  assert.equal(clock.position({ state: 0, positionMs: 12000 }, 5000), 15000);
});

test('reanchors when playback resumes after a pause', () => {
  const clock = createPlaybackClock();
  clock.update('song-1', { state: 0, positionMs: 12000 }, 1000);
  clock.update('song-1', { state: 1, positionMs: 15000 }, 2000);
  clock.update('song-1', { state: 0, positionMs: 15000 }, 4000);

  assert.equal(clock.position({ state: 0, positionMs: 15000 }, 5000), 16000);
});

