import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const scriptsRoot = new URL('../../../scripts/', import.meta.url);

 test('bridge autostart scripts register and remove a per-user logon task', async () => {
  const installUrl = new URL('install-bridge-autostart.ps1', scriptsRoot);
  const uninstallUrl = new URL('uninstall-bridge-autostart.ps1', scriptsRoot);
  const launcherUrl = new URL('start-bridge.ps1', scriptsRoot);

  await Promise.all([access(installUrl), access(uninstallUrl), access(launcherUrl)]);

  const install = await readFile(installUrl, 'utf8');
  const uninstall = await readFile(uninstallUrl, 'utf8');
  const launcher = await readFile(launcherUrl, 'utf8');

  assert.match(install, /New-ScheduledTaskTrigger\s+-AtLogOn/u);
  assert.match(install, /Register-ScheduledTask/u);
  assert.match(install, /SystemRoot.*WindowsPowerShell.*powershell\.exe/u);
  assert.match(install, /RunLevel Limited/u);
  assert.match(install, /start-bridge\.ps1/u);
  assert.match(uninstall, /Unregister-ScheduledTask/u);
  assert.match(uninstall, /NeteaseLyricsBridge/u);
  assert.match(launcher, /127\.0\.0\.1:18763/u);
  assert.match(launcher, /Start-Process/u);
  assert.match(launcher, /dotnet(?:\.exe)?/u);
});
