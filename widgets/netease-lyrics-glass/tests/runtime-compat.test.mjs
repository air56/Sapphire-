import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const widgetRoot = new URL('../', import.meta.url);
const metadata = JSON.parse(await readFile(new URL('../metadata.json', import.meta.url), 'utf8'));

test('Sapphire entry uses a classic runtime script for qrc WebEngine compatibility', async () => {
  const html = await readFile(new URL('index.html', widgetRoot), 'utf8');

  assert.ok(html.includes(`<script src="./app.runtime.js?v=${metadata.version}"></script>`));
  assert.doesNotMatch(html, /type="module"/);
});

test('classic runtime marks execution before connecting to the bridge', async () => {
  const runtime = await readFile(new URL('app.runtime.js', widgetRoot), 'utf8');

  assert.ok(runtime.includes(`dataset.neteaseLyricsRuntime = '${metadata.version}'`));
  assert.match(runtime, /__neteaseLyricsRuntime/);
  assert.doesNotMatch(runtime, /^\s*import\s/m);
  assert.match(runtime, /playback-state\.js/);
});

