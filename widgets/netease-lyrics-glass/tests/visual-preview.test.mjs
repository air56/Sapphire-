import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const previewUrl = new URL('../visual-style.html', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);

test('visual preview provides wide, stacked, and compact responsive frames', async () => {
  const page = await readFile(previewUrl, 'utf8');

  assert.match(page, /class="preview-frame wide"/);
  assert.match(page, /class="preview-frame stacked"/);
  assert.match(page, /class="preview-frame compact"/);
  assert.match(page, /src="\.\/index\.html\?__sapphireVisualPreview=wide"/);
  assert.match(page, /src="\.\/index\.html\?__sapphireVisualPreview=stacked"/);
  assert.match(page, /src="\.\/index\.html\?__sapphireVisualPreview=compact"/);
  assert.match(page, /@media \(max-width: 720px\) \{ body \{ padding: 8px; \}/);
});

test('compact layout keeps each displayed lyric line inside a short widget', async () => {
  const styles = await readFile(stylesUrl, 'utf8');

  assert.match(styles, /\[data-layout='compact'\] \.lyric-text \{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/);
});
