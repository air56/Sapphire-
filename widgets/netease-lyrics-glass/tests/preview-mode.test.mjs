import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisualPreviewSnapshot } from '../preview-mode.js';
import { selectDisplayLines } from '../lyric-view-model.js';

test('visual preview exposes a paused bilingual lyric snapshot for all supported frames', () => {
  for (const mode of ['wide', 'stacked', 'compact']) {
    const snapshot = createVisualPreviewSnapshot(mode);
    const selected = selectDisplayLines(snapshot.lyrics.lines, snapshot.playback.positionMs, 56);

    assert.equal(snapshot.bridge.status, 'ready');
    assert.equal(snapshot.playback.state, 'paused');
    assert.equal(selected.currentOriginal, '我听见风穿过城市');
    assert.equal(selected.currentTranslation, 'I hear the wind passing through the city');
    assert.equal(selected.nextOriginal, '把漫长的夜点亮');
  }
});

test('visual preview ignores unknown frame modes', () => {
  assert.equal(createVisualPreviewSnapshot('full-screen'), null);
});
