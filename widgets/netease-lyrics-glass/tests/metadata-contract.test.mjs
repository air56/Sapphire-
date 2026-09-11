import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const metadataUrl = new URL('../metadata.json', import.meta.url);
const packageScriptUrl = new URL('../../../scripts/package-widget.ps1', import.meta.url);
const bridgeScriptUrl = new URL('../../../scripts/run-bridge.ps1', import.meta.url);

test('Sapphire HTML widget points directly to its HTML entry and declares SMTC support', async () => {
  const metadata = JSON.parse(await readFile(metadataUrl, 'utf8'));

  assert.equal(metadata.widgetType, 'Html');
  assert.equal(metadata.widgetFileName, 'index.html');
  assert.equal(metadata.acceptsMouseEvents, true);
  assert.deepEqual(metadata.functions, ['SMTC']);
});

test('package requires and ships the configured preview image instead of a QML entry wrapper', async () => {
  const metadata = JSON.parse(await readFile(metadataUrl, 'utf8'));
  const previewUrl = new URL(`../${metadata.previewImageFileName}`, import.meta.url);
  const packageScript = await readFile(packageScriptUrl, 'utf8');

  await access(previewUrl);
  assert.match(packageScript, /'preview\.png'/);
  assert.doesNotMatch(packageScript, /'SWebWidget\.qml'/);
});

test('HTML assets include the widget version to bust Sapphire WebEngine cache after upgrades', async () => {
  const metadata = JSON.parse(await readFile(metadataUrl, 'utf8'));
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.ok(index.includes(`./styles.css?v=${metadata.version}`));
  assert.ok(index.includes(`./app.js?v=${metadata.version}`));
});
test('package output embeds the metadata version to force Sapphire package refresh', async () => {
  const packageScript = await readFile(packageScriptUrl, 'utf8');

  assert.match(packageScript, /ConvertFrom-Json/);
  assert.ok(packageScript.includes("('netease-lyrics-glass-v{0}.sawidget' -f $version)"));
});

test('run-bridge.ps1 is UTF-8 BOM encoded for Windows PowerShell 5.1', async () => {
  const bytes = await readFile(bridgeScriptUrl);

  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.doesNotMatch(bytes.toString('utf8'), /```/u);
});
