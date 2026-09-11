import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const previewUrl = new URL('../visual-style.html', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);

 test('visual preview exposes independent language font selectors and transparent controls', async () => {
  const page = await readFile(previewUrl, 'utf8');

  assert.match(page, /id="lyrics-preview-frame"/);
  assert.match(page, /id="font-zh"/);
  assert.match(page, /id="font-ja"/);
  assert.match(page, /id="font-latin"/);
  assert.match(page, /id="width-input"/);
  assert.match(page, /id="height-input"/);
  assert.match(page, /id="translation-toggle"/);
  assert.match(page, /id="style-choice"/);
  assert.match(page, /visual-preview\.js/);
  assert.match(page, /visual-preview\.css/);
});

test('compact layout keeps each displayed lyric line inside a short widget', async () => {
  const styles = await readFile(stylesUrl, 'utf8');

  assert.match(styles, /\[data-layout='compact'\] \.lyric-text \{[^}]*white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/);
});

test('visual preview snapshot source includes mixed language and missing translation lines', async () => {
  const source = await readFile(new URL('../preview-mode.js', import.meta.url), 'utf8');

  assert.match(source, /もう一度だけ/);
  assert.match(source, /再一次就好/);
  assert.match(source, /I will remember the light/);
  assert.match(source, /translation: null/);
});

test('widget markup exposes fixed bilingual slots and language font hooks', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const styles = await readFile(stylesUrl, 'utf8');

  assert.match(index, /id="current-slot"/);
  assert.match(index, /id="current-original-zh"/);
  assert.match(index, /id="current-original-ja"/);
  assert.match(index, /id="current-original-latin"/);
  assert.match(index, /id="current-translation"/);
  assert.match(styles, /background:\s*transparent/);
  assert.match(styles, /--lyric-slot-height/);
  assert.match(styles, /font-family:\s*var\(--font-zh/);
  assert.match(styles, /font-family:\s*var\(--font-ja/);
  assert.match(styles, /font-family:\s*var\(--font-latin/);
});
