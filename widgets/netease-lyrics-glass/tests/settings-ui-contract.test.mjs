import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);

async function readUiFiles() {
  return {
    index: await readFile(indexUrl, 'utf8'),
    styles: await readFile(stylesUrl, 'utf8')
  };
}

test('settings toggle has a prominent, accessible hit area', async () => {
  const { index, styles } = await readUiFiles();

  assert.match(index, /<button id="settings-toggle"[^>]*class="[^"]*icon-button[^"]*"/);
  assert.match(index, /id="settings-toggle"[^>]*aria-controls="settings-panel"/);
  assert.match(styles, /\.icon-button\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;/s);
  assert.match(styles, /\.icon-button\s*\{[^}]*font-size:\s*18px;/s);
  assert.match(styles, /\.icon-button\s*\{[^}]*border:\s*1px solid/s);
});

test('settings panel exposes an explicit close button', async () => {
  const { index, styles } = await readUiFiles();

  assert.match(index, /<aside id="settings-panel"[^>]*>/);
  assert.match(index, /<button id="settings-close"[^>]*class="[^"]*settings-close[^"]*"/);
  assert.match(index, /id="settings-close"[^>]*type="button"/);
  assert.match(index, /id="settings-close"[^>]*aria-label="关闭歌词设置"/);
  assert.match(index, /id="settings-close"[^>]*title="关闭"/);
  assert.match(styles, /\.settings-heading\s*\{[^}]*align-items:\s*center;/s);
  assert.match(styles, /\.settings-close\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s);
  assert.match(styles, /\.settings-close:hover,\s*\.settings-close:focus-visible\s*\{/s);
});
