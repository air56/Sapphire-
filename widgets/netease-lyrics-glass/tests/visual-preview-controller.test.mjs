import test from 'node:test';
import assert from 'node:assert/strict';

test('visual preview controller normalizes dimensions and keeps A defaults transparent', async () => {
  const source = await import('../visual-preview.js');
  const result = source.normalizeVisualPreview({ width: 40, height: 900, opacity: 2, background: 'card' });

  assert.equal(result.width, 160);
  assert.equal(result.height, 420);
  assert.equal(result.opacity, 1);
  assert.equal(result.background, 'transparent');
});

test('visual preview controller sends language fonts and translation state to iframe', async () => {
  const { createPreviewMessage } = await import('../visual-preview.js');
  const message = createPreviewMessage({
    zhFont: 'Noto Sans SC',
    jaFont: 'Noto Sans JP',
    latinFont: 'Atkinson Hyperlegible',
    translationVisible: true,
    style: 'transparent-shadow'
  });
  assert.equal(message.type, 'netease-lyrics-visual-preview');
  assert.equal(message.settings.zhFont, 'Noto Sans SC');
  assert.equal(message.settings.jaFont, 'Noto Sans JP');
  assert.equal(message.settings.latinFont, 'Atkinson Hyperlegible');
  assert.equal(message.settings.translationVisible, true);
  assert.equal(message.settings.background, 'transparent');
});

test('visual preview controller serializes a portable selection summary', async () => {
  const { serializeSelection } = await import('../visual-preview.js');
  assert.deepEqual(serializeSelection({ zhFont: 'A', jaFont: 'B', latinFont: 'C', style: 'transparent-shadow' }), {
    style: 'transparent-shadow',
    zhFont: 'A',
    jaFont: 'B',
    latinFont: 'C'
  });
});

test('style choices are transparent text-layer variants', async () => {
  const { listVisualStyles } = await import('../visual-preview.js');
  const styles = listVisualStyles();
  assert.deepEqual(styles.map((item) => item.id), [
    'transparent-shadow',
    'transparent-glow',
    'transparent-soft'
  ]);
  assert.ok(styles.every((item) => item.background === 'transparent'));
});


