import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const metadataUrl = new URL('../metadata.json', import.meta.url);
const widgetRoot = new URL('../', import.meta.url);

 test('visual preview page cache-busts the embedded runtime with the metadata version', async () => {
  const metadata = JSON.parse(await readFile(metadataUrl, 'utf8'));
  const page = await readFile(new URL('visual-style.html', widgetRoot), 'utf8');

  assert.ok(page.includes(`index.html?__sapphireVisualPreview=interactive&v=${metadata.version}`));
});

test('visual preview page exposes output labels and selectable style states', async () => {
  const page = await readFile(new URL('visual-style.html', widgetRoot), 'utf8');

  for (const id of ['width-output', 'height-output', 'font-size-output', 'translation-size-output', 'gap-output']) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  assert.match(page, /aria-pressed="true"/);
});
