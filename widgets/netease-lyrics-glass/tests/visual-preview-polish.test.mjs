import test from 'node:test';
import assert from 'node:assert/strict';

test('visual preview formats a human-readable selection summary', async () => {
  const { formatVisualPreviewSummary } = await import('../visual-preview.js');
  assert.equal(
    formatVisualPreviewSummary({ style: 'transparent-glow', zhFont: '"Microsoft YaHei", system-ui', jaFont: '"Yu Gothic UI", system-ui', latinFont: '"Aptos", system-ui' }),
    '已选择：柔和光晕 · 中文 微软雅黑 · 日文 游ゴシック UI · 英文 Aptos'
  );
});

test('visual preview defaults each effect to its own shadow and glow balance', async () => {
  const { normalizeVisualPreview } = await import('../visual-preview.js');
  const result = normalizeVisualPreview({ style: 'transparent-glow' });
  assert.equal(result.shadow, 0.26);
  assert.equal(result.glow, 0.32);
});
