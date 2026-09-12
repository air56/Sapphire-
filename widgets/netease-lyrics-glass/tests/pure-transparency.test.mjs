import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('formal widget uses a pure transparent surface without decorative background layers', async () => {
  const styles = await readFile(new URL('styles.css', root), 'utf8');
  const index = await readFile(new URL('index.html', root), 'utf8');
  const metadata = JSON.parse(await readFile(new URL('metadata.json', root), 'utf8'));

  assert.match(styles, /html,\s*body\s*\{[^}]*background:\s*transparent/s);
  assert.match(styles, /#widget-root\s*\{[^}]*background:\s*transparent\s*!important/s);
  assert.match(styles, /#widget-root\s*\{[^}]*border:\s*0\s*!important/s);
  assert.match(styles, /#widget-root\s*\{[^}]*box-shadow:\s*none\s*!important/s);
  assert.match(styles, /\.lyrics-card,\s*\.lyrics,\s*\.lyric-slot\s*\{[^}]*background:\s*transparent/s);
  assert.doesNotMatch(styles, /\.ambient-glow/);
  assert.doesNotMatch(index, /ambient-glow/);
  assert.match(styles, /\.icon-button\s*\{[^}]*background:\s*transparent/s);
  assert.equal(metadata.defaultShowBackground, false);
  assert.equal(metadata.defaultShowSide, false);
});
