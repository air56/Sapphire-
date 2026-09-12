import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_SETTINGS, normalizeSettings } from '../settings.js';

const root = new URL('../', import.meta.url);

test('formal widget defaults match the selected low-interference visual design', () => {
  assert.equal(DEFAULT_SETTINGS.fontSize, 37);
  assert.equal(DEFAULT_SETTINGS.translationSize, 16);
  assert.equal(DEFAULT_SETTINGS.translationGap, 9);
  assert.equal(DEFAULT_SETTINGS.zhFont, '"Noto Sans SC", "Microsoft YaHei", sans-serif');
  assert.equal(DEFAULT_SETTINGS.jaFont, '"Yu Gothic UI", "Noto Sans JP", sans-serif');
  assert.equal(DEFAULT_SETTINGS.latinFont, '"Atkinson Hyperlegible", "Aptos", sans-serif');
  assert.equal(DEFAULT_SETTINGS.textShadowStrength, 0.2);
  assert.equal(DEFAULT_SETTINGS.textGlowStrength, 0.08);
  assert.equal(DEFAULT_SETTINGS.background, 'transparent');
});

test('visual defaults survive normalization and reject invalid persisted values', () => {
  const settings = normalizeSettings({ fontSize: 999, translationSize: 'bad', translationGap: 999, zhFont: '' });
  assert.equal(settings.fontSize, 48);
  assert.equal(settings.translationSize, 16);
  assert.equal(settings.translationGap, 24);
  assert.equal(settings.zhFont, DEFAULT_SETTINGS.zhFont);
});

test('package metadata uses the selected wide and shallow canvas defaults', async () => {
  const metadata = JSON.parse(await readFile(new URL('metadata.json', root), 'utf8'));
  assert.equal(metadata.defaultWidth, 960);
  assert.equal(metadata.defaultHeight, 216);
  assert.equal(metadata.defaultShowBackground, false);
});

test('runtime applies the selected language font stacks and low-interference effect', async () => {
  const app = await readFile(new URL('app.js', root), 'utf8');
  const styles = await readFile(new URL('styles.css', root), 'utf8');
  assert.match(app, /--font-zh/);
  assert.match(app, /--text-shadow-strength/);
  assert.match(app, /renderScriptText\(originalElement, original\)/);
  assert.match(styles, /--font-zh:\s*"Noto Sans SC"/);
  assert.match(styles, /--font-ja:\s*"Yu Gothic UI"/);
  assert.match(styles, /--font-latin:\s*"Atkinson Hyperlegible"/);
  assert.match(styles, /--text-shadow-strength:\s*\.2/);
  assert.match(styles, /--text-glow-strength:\s*\.08/);
});

test('bridge runtime keeps polling snapshots when SSE updates are unavailable', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /SNAPSHOT_POLL_INTERVAL_MS/);
  assert.match(app, /startSnapshotPolling\(\)/);
  assert.match(app, /fetchSnapshot\(\)/);
});
