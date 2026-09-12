import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('README documents installation, autostart, troubleshooting, and declarations', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  for (const heading of [
    '## 功能特性',
    '## 安装与使用',
    '### 3. 设置 Bridge 登录自启',
    '## 工作原理',
    '## 故障排查',
    '## 隐私与声明',
    '## 开发与测试'
  ]) {
    assert.match(readme, new RegExp(heading));
  }

  assert.match(readme, /127\.0\.0\.1:18763/u);
  assert.match(readme, /install-bridge-autostart\.ps1/u);
  assert.match(readme, /uninstall-bridge-autostart\.ps1/u);
  assert.match(readme, /歌词版权/u);
  assert.match(readme, /未与网易云音乐官方建立合作/u);
  assert.match(readme, /不上传账户信息/u);
});
