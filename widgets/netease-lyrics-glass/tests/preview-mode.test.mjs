import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisualPreviewSnapshot, getVisualPreviewMode } from '../preview-mode.js';
import { selectDisplayLines } from '../lyric-view-model.js';

test('visual preview exposes a paused bilingual lyric snapshot for all supported frames', () => {
  for (const mode of ['wide', 'stacked', 'compact']) {
    const snapshot = createVisualPreviewSnapshot(mode);
    const selected = selectDisplayLines(snapshot.lyrics.lines, snapshot.playback.positionMs, 56);

    assert.equal(snapshot.bridge.status, 'ready');
    assert.equal(snapshot.playback.state, 'paused');
    assert.equal(selected.currentOriginal, 'Moonlight on the sea');
    assert.equal(selected.currentTranslation, '月光洒落海面');
    assert.equal(selected.nextOriginal, 'The night grows bright');
  }
});

test('visual preview ignores unknown frame modes', () => {
  assert.equal(createVisualPreviewSnapshot('full-screen'), null);
});

test('visual demo mode requires an embedded explicit preview signal', () => {
  const parent = 'http://127.0.0.1:61329/visual-style.html';

  assert.equal(getVisualPreviewMode('?__sapphireVisualPreview=wide', parent, true), 'wide');
  assert.equal(getVisualPreviewMode('?__sapphireVisualPreview=wide', parent, false), null);
  assert.equal(getVisualPreviewMode('?__sapphireVisualPreview=wide', '', true), 'wide');
  assert.equal(getVisualPreviewMode('?preview=wide', parent), null);
  assert.equal(getVisualPreviewMode('?__sapphireVisualPreview=full-screen', parent), null);
});
