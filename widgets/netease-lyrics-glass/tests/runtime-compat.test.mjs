import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const widgetRoot = new URL('../', import.meta.url);

test('Sapphire entry uses a classic runtime script for qrc WebEngine compatibility', async () => {
  const html = await readFile(new URL('index.html', widgetRoot), 'utf8');

  assert.match(html, /<script src="\.\/app\.runtime\.js\?v=0\.1\.9"><\/script>/);
  assert.doesNotMatch(html, /type="module"/);
});

test('classic runtime marks execution before connecting to the bridge', async () => {
  const runtime = await readFile(new URL('app.runtime.js', widgetRoot), 'utf8');

  assert.match(runtime, /dataset\.neteaseLyricsRuntime\s*=\s*['"]0\.1\.9['"]/);
  assert.match(runtime, /__neteaseLyricsRuntime/);
  assert.doesNotMatch(runtime, /^\s*import\s/m);
  assert.match(runtime, /playback-state\.js/);
});

