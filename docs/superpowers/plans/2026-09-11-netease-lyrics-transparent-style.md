# 网易云歌词透明视觉预览实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在不改变网易云识别和正式组件实时播放逻辑的前提下，制作一个可交互的网页视觉预览，验证透明文字层、固定高度双语歌词和中日英独立字体选择。

**架构：** 复用现有 `index.html` 的预览快照入口和 `preview-mode.js` 的静态歌词数据；新增一个独立的预览控制页，控制页通过 CSS 变量和 `postMessage` 驱动嵌入的歌词组件 iframe。正式组件继续使用自身的设置持久化和桥接逻辑，预览页不读取本地隐私、不连接 Bridge、不依赖外部字体网络。

**技术栈：** 原生 HTML/CSS/ES modules、Node 内置 `node:test`、PowerShell、现有 Sapphire WebEngine 兼容入口。

---

## 文件清单与职责

### 将创建

- `widgets/netease-lyrics-glass/visual-preview.js`：预览控制器；管理尺寸、语言字体、颜色、阴影、双语开关、播放模拟和样式选择保存。
- `widgets/netease-lyrics-glass/visual-preview.css`：预览控制台、桌面壁纸模拟背景、样式卡片和响应式布局。
- `widgets/netease-lyrics-glass/tests/visual-preview-controller.test.mjs`：预览控制器的纯函数行为测试。

### 将修改

- `widgets/netease-lyrics-glass/visual-style.html`：从静态 iframe 列表改为交互式字体/透明效果选择页，并嵌入歌词预览画布。
- `widgets/netease-lyrics-glass/index.html`：增加固定歌词 slot 的 DOM 结构、语言片段容器和预览消息接收钩子；保持 Sapphire 正式入口可直接运行。
- `widgets/netease-lyrics-glass/styles.css`：移除正式歌词区域的明显玻璃卡片背景，增加透明文字层、双语固定高度 slot、中日英字体变量和预览覆盖样式。
- `widgets/netease-lyrics-glass/preview-mode.js`：扩展静态预览快照，覆盖中文、日文、英文、带翻译和不带翻译的连续歌词。
- `widgets/netease-lyrics-glass/lyric-view-model.js`：将当前/下一句输出扩展为稳定的歌词单元数据，明确翻译行存在但为空时仍保留布局高度。
- `widgets/netease-lyrics-glass/tests/lyric-view-model.test.mjs`：先补充固定 slot、双语显示和混合语言样例的失败测试。
- `widgets/netease-lyrics-glass/tests/visual-preview.test.mjs`：更新页面契约测试，验证控制器、字体选择器、尺寸控制和嵌入预览存在。
- `widgets/netease-lyrics-glass/settings.js`：仅在正式组件需要复用时增加透明视觉设置的规范化字段；保留现有设置键兼容，不保存预览页临时状态到正式设置。
- `docs/user-guide.md`：补充网页预览打开方式、视觉参数说明和字体授权边界。

### 不修改

- `src/NeteaseLyricsBridge/**`：本阶段不改变歌词识别、SMTC 或网络桥接。
- `scripts/run-bridge.ps1`：不触碰已修复的 Windows PowerShell 启动脚本。
- `scripts/package-widget.ps1`：预览控制页不进入正式安装包，保持现有打包清单。

---

## 任务 1：定义稳定双语歌词单元并写失败测试

**文件：**
- 修改：`widgets/netease-lyrics-swidget/widgets/netease-lyrics-glass/lyric-view-model.js`
- 修改：`widgets/netease-lyrics-swidget/widgets/netease-lyrics-glass/tests/lyric-view-model.test.mjs`

- [ ] **步骤 1：编写失败测试**

在 `lyric-view-model.test.mjs` 增加以下行为断言：

```js
test('selectDisplayLines returns fixed-height lyric slots for translated and untranslated lines', () => {
  const result = selectDisplayLines([
    { startMs: 0, original: 'もう一度だけ', translation: '再一次就好' },
    { startMs: 5000, original: '下一句没有翻译', translation: null }
  ], 0, 56);

  assert.deepEqual(result.currentSlot, {
    original: 'もう一度だけ',
    translation: '再一次就好',
    hasTranslation: true,
    slotKey: 'current-0'
  });
  assert.deepEqual(result.nextSlot, {
    original: '下一句没有翻译',
    translation: null,
    hasTranslation: false,
    slotKey: 'next-1'
  });
});

test('selectDisplayLines preserves next slot identity when translation is toggled', () => {
  const withoutTranslation = selectDisplayLines([
    { startMs: 0, original: 'line', translation: null },
    { startMs: 5000, original: 'next', translation: null }
  ], 0, 56);
  const withTranslation = selectDisplayLines([
    { startMs: 0, original: 'line', translation: '翻译' },
    { startMs: 5000, original: 'next', translation: null }
  ], 0, 56);

  assert.equal(withoutTranslation.nextSlot.slotKey, withTranslation.nextSlot.slotKey);
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests/lyric-view-model.test.mjs
```

预期：FAIL，当前返回值没有 `currentSlot`、`nextSlot` 和稳定 `slotKey`。

- [ ] **步骤 3：编写最少实现**

在 `lyric-view-model.js` 增加 `createSlot(line, role, index, maxChars)`，返回 `original`、`translation`、`hasTranslation` 和稳定键；同时保留现有 `currentOriginal`、`currentTranslation`、`nextOriginal` 字段，避免正式渲染逻辑回归。

- [ ] **步骤 4：运行测试确认通过**

运行同一命令，预期全部 lyric view-model 测试 PASS。

- [ ] **步骤 5：Commit**

```powershell
git add widgets/netease-lyrics-glass/lyric-view-model.js widgets/netease-lyrics-glass/tests/lyric-view-model.test.mjs
git commit -m "test: 定义固定高度双语歌词单元"
```

---

## 任务 2：扩展静态预览数据并写页面契约测试

**文件：**
- 修改：`widgets/netease-lyrics-glass/preview-mode.js`
- 修改：`widgets/netease-lyrics-glass/tests/visual-preview.test.mjs`

- [ ] **步骤 1：编写失败测试**

增加契约断言：

```js
test('visual preview page exposes independent language font selectors and transparent style controls', async () => {
  const page = await readFile(previewUrl, 'utf8');

  assert.match(page, /id="font-zh"/);
  assert.match(page, /id="font-ja"/);
  assert.match(page, /id="font-latin"/);
  assert.match(page, /id="width-input"/);
  assert.match(page, /id="height-input"/);
  assert.match(page, /id="translation-toggle"/);
  assert.match(page, /id="style-choice"/);
  assert.match(page, /visual-preview\.js/);
});

test('visual preview snapshot includes mixed language and missing translation lines', async () => {
  const source = await readFile(new URL('../preview-mode.js', import.meta.url), 'utf8');

  assert.match(source, /もう一度だけ/);
  assert.match(source, /再一次就好/);
  assert.match(source, /I will remember the light/);
  assert.match(source, /translation: null/);
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests/visual-preview.test.mjs
```

预期：FAIL，旧页面没有控制器和字体选择器，快照也没有完整混合语言样例。

- [ ] **步骤 3：编写最少实现**

将 `preview-mode.js` 的预览线路扩展为至少六句固定时间轴歌词：中文、日文带翻译、英文带翻译、无翻译、混合语言；保持 `createVisualPreviewSnapshot` 返回现有 track/playback/lyrics 结构。

- [ ] **步骤 4：运行测试确认通过**

运行同一命令，预期现有 iframe 断言和新增契约断言全部 PASS。

- [ ] **步骤 5：Commit**

```powershell
git add widgets/netease-lyrics-glass/preview-mode.js widgets/netease-lyrics-glass/tests/visual-preview.test.mjs
git commit -m "test: 增加透明歌词预览契约"
```

---

## 任务 3：实现预览控制器纯函数

**文件：**
- 创建：`widgets/netease-lyrics-glass/visual-preview.js`
- 创建：`widgets/netease-lyrics-glass/tests/visual-preview-controller.test.mjs`

- [ ] **步骤 1：编写失败测试**

创建针对无 DOM 纯函数的测试：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VISUAL_PREVIEW,
  normalizeVisualPreview,
  createPreviewMessage,
  serializeSelection
} from '../visual-preview.js';

test('normalizeVisualPreview clamps independent size controls and keeps A defaults transparent', () => {
  const result = normalizeVisualPreview({ width: 40, height: 900, opacity: 2, background: 'card' });

  assert.equal(result.width, 160);
  assert.equal(result.height, 420);
  assert.equal(result.opacity, 1);
  assert.equal(result.background, 'transparent');
});

test('createPreviewMessage sends language fonts and fixed slot options to the iframe', () => {
  const message = createPreviewMessage({
    zhFont: 'Noto Sans SC',
    jaFont: 'Noto Sans JP',
    latinFont: 'Atkinson Hyperlegible',
    translationVisible: true,
    style: 'transparent-shadow'
  });

  assert.deepEqual(message, {
    type: 'netease-lyrics-visual-preview',
    settings: {
      zhFont: 'Noto Sans SC',
      jaFont: 'Noto Sans JP',
      latinFont: 'Atkinson Hyperlegible',
      translationVisible: true,
      style: 'transparent-shadow'
    }
  });
});

test('serializeSelection returns a portable selection summary', () => {
  assert.deepEqual(serializeSelection({ zhFont: 'A', jaFont: 'B', latinFont: 'C', style: 'transparent-shadow' }), {
    style: 'transparent-shadow',
    zhFont: 'A',
    jaFont: 'B',
    latinFont: 'C'
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests/visual-preview-controller.test.mjs
```

预期：FAIL，`visual-preview.js` 尚不存在。

- [ ] **步骤 3：编写最少实现**

实现：

- `DEFAULT_VISUAL_PREVIEW`：透明背景、A 方案阴影、宽 640、高 180、三种默认字体。
- `normalizeVisualPreview(input)`：限制宽度 160–960、高度 96–420、字号 16–64、透明度 0.35–1、阴影 0–1，并强制背景类型为 `transparent`。
- `createPreviewMessage(settings)`：生成 iframe 消息，不携带 track、Bridge 或本地路径。
- `serializeSelection(settings)`：只返回样式和三种字体名称，供页面展示和复制。
- DOM 控制器：将 input/select 的变化写入预览画布 CSS，并通过 `postMessage` 发给 iframe；“选择此样式”按钮将选择摘要显示在页面，不写正式组件设置。

- [ ] **步骤 4：运行测试确认通过**

运行同一命令，预期全部 PASS。

- [ ] **步骤 5：Commit**

```powershell
git add widgets/netease-lyrics-glass/visual-preview.js widgets/netease-lyrics-glass/tests/visual-preview-controller.test.mjs
git commit -m "feat: 添加歌词视觉预览控制器"
```

---

## 任务 4：实现透明文字层与固定高度双语布局

**文件：**
- 修改：`widgets/netease-lyrics-glass/index.html`
- 修改：`widgets/netease-lyrics-glass/styles.css`
- 修改：`widgets/netease-lyrics-glass/app.js`
- 修改：`widgets/netease-lyrics-glass/preview-mode.js`

- [ ] **步骤 1：编写失败测试**

在 `visual-preview.test.mjs` 增加静态结构断言：

```js
test('widget markup exposes fixed bilingual slots and language spans', async () => {
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
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests/visual-preview.test.mjs
```

预期：FAIL，旧结构是三个独立 `<p>`，没有固定歌词 slot 和按语言 span。

- [ ] **步骤 3：编写最少实现**

修改 DOM 为两个固定 slot：当前 slot 和下一句 slot。每个 slot 内含原文、翻译和按语言拆分的 span。为兼容现有实时逻辑，保留原有 id 或在 `app.js` 中集中更新新 id，不让播放时钟和 Bridge 代码改变。

在 `app.js` 增加：

- `splitTextByScript(text)`：把汉字、日文假名、拉丁字符拆成语言 span；
- `renderSlot(slotElement, line, role)`：清理 slot 后写入原文和翻译，翻译为空时写入占位节点并保留高度；
- `applyPreviewMessage(message)`：只在 `window.parent !== window` 且消息来源为当前页面父窗口时应用预览 CSS 变量；
- 将 `renderLyrics()` 改为使用 `currentSlot`/`nextSlot`，但保留旧字段作为回退。

在 `styles.css`：

- `#widget-root` 设置 `background: transparent; border: 0; box-shadow: none; backdrop-filter: none;`；
- 将装饰光晕改为默认关闭，避免形成卡片轮廓；
- `.lyric-slot` 使用固定 `min-height: var(--lyric-slot-height)`，原文和翻译使用内部 grid；
- 翻译占位使用 `visibility: hidden` 而不是 `display: none`；
- 中、日、英 span 使用 `--font-zh`、`--font-ja`、`--font-latin`；
- 使用文字阴影和可调柔光，不绘制矩形边框；
- 响应式宽高仍由容器决定，宽高独立，不再依赖正方形默认值。

- [ ] **步骤 4：运行测试确认通过**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests
```

预期：全部现有测试与新增结构测试 PASS。

- [ ] **步骤 5：Commit**

```powershell
git add widgets/netease-lyrics-glass/index.html widgets/netease-lyrics-glass/styles.css widgets/netease-lyrics-glass/app.js widgets/netease-lyrics-glass/preview-mode.js

git commit -m "feat: 实现透明固定高度双语歌词布局"
```

---

## 任务 5：实现网页视觉选择页

**文件：**
- 修改：`widgets/netease-lyrics-glass/visual-style.html`
- 创建：`widgets/netease-lyrics-glass/visual-preview.css`
- 修改：`widgets/netease-lyrics-glass/visual-preview.js`

- [ ] **步骤 1：编写失败测试**

在 `visual-preview-controller.test.mjs` 增加：

```js
test('style choices use transparent text-layer variants instead of card backgrounds', () => {
  const styles = listVisualStyles();

  assert.deepEqual(styles.map((item) => item.id), [
    'transparent-shadow',
    'transparent-glow',
    'transparent-soft'
  ]);
  assert.ok(styles.every((item) => item.background === 'transparent'));
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests/visual-preview-controller.test.mjs
```

预期：FAIL，尚未导出 `listVisualStyles`。

- [ ] **步骤 3：编写最少实现**

在 `visual-preview.js` 导出固定样式列表：

- `transparent-shadow`：黑色阴影 + 微弱白色轮廓，A 方案默认；
- `transparent-glow`：阴影较小、柔光较强；
- `transparent-soft`：阴影和柔光均低，最接近时钟插件的低干扰效果。

`visual-style.html` 采用左右布局：左侧设置栏，右侧透明桌面模拟区。设置栏包含：

- 三个语言字体选择器：中文、日文/假名、英文/拉丁；
- 宽度、高度、字号、翻译字号、歌词间距、阴影强度和文字颜色；
- 双语翻译显示开关；
- 三张透明样式卡片；
- 上一句/下一句、播放/暂停和自动滚动控制；
- “选择此样式”按钮和当前选择摘要。

iframe 使用 `index.html?__sapphireVisualPreview=interactive`，父页等待 iframe `load` 后发送 `createPreviewMessage`。背景仅为可切换的桌面壁纸模拟渐变，歌词 iframe 自身保持透明。

- [ ] **步骤 4：运行测试确认通过**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests
```

预期：全部测试 PASS。

- [ ] **步骤 5：Commit**

```powershell
git add widgets/netease-lyrics-glass/visual-style.html widgets/netease-lyrics-glass/visual-preview.css widgets/netease-lyrics-glass/visual-preview.js
git commit -m "feat: 制作透明歌词视觉选择预览"
```

---

## 任务 6：添加字体与设置文档边界

**文件：**
- 修改：`widgets/netease-lyrics-glass/settings.js`
- 修改：`widgets/netease-lyrics-glass/tests/settings.test.mjs`
- 修改：`docs/user-guide.md`

- [ ] **步骤 1：编写失败测试**

若正式组件设置需要保存已确认的字体和透明参数，先增加兼容性测试：

```js
test('normalizeSettings accepts optional visual preferences without changing old defaults', () => {
  assert.deepEqual(normalizeSettings({}), {
    fontSize: 26,
    maxChars: 56,
    color: '#F7FBFF',
    visualStyle: 'transparent-shadow',
    zhFont: 'system-ui',
    jaFont: 'system-ui',
    latinFont: 'system-ui'
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests/settings.test.mjs
```

预期：FAIL，当前设置对象只有字号、长度和颜色。

- [ ] **步骤 3：编写最少实现**

仅当用户从预览中确定字体后，才将 `visualStyle`、`zhFont`、`jaFont`、`latinFont` 加入规范化设置；旧存储 JSON 缺字段时填充安全的系统字体栈。文档明确预览页的字体名称只是候选，正式打包前必须确认开源授权并将字体文件放入组件资源目录，禁止运行时访问未知 CDN。

- [ ] **步骤 4：运行测试确认通过**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests/settings.test.mjs
```

预期：设置测试全部 PASS，原有保存和回退行为不变。

- [ ] **步骤 5：Commit**

```powershell
git add widgets/netease-lyrics-glass/settings.js widgets/netease-lyrics-glass/tests/settings.test.mjs docs/user-guide.md
git commit -m "docs: 说明字体授权与视觉设置边界"
```

---

## 任务 7：预览浏览器验证与最终回归

**文件：**
- 可能修改：`widgets/netease-lyrics-glass/visual-style.html`
- 可能修改：`widgets/netease-lyrics-glass/visual-preview.css`
- 可能修改：`widgets/netease-lyrics-glass/styles.css`

- [ ] **步骤 1：运行静态测试**

运行：

```powershell
node --test widgets/netease-lyrics-glass/tests
```

预期：所有 Node 测试 PASS，输出无 FAIL。

- [ ] **步骤 2：启动本地静态服务器**

运行：

```powershell
python -m http.server 61329 --directory widgets/netease-lyrics-glass
```

预期：服务器监听 `http://127.0.0.1:61329/`，浏览器可打开 `/visual-style.html`。

- [ ] **步骤 3：执行浏览器视觉检查**

检查以下断言：

1. 歌词区域可看到模拟壁纸，未出现不透明矩形卡片。
2. 切换中文、日文、英文选择器时，对应脚本文字字体改变，其他脚本不被重置。
3. 切换翻译开关时，下一句歌词的顶部位置保持不变。
4. 调整宽度和高度时，组件分别变化，不强制成正方形。
5. 点击三种透明样式卡片和“选择此样式”后，页面显示当前摘要。
6. 播放模拟继续推进歌词，预览不会停留在第一句。
7. 刷新后不会向 Bridge 发请求，也不会读取用户本地播放数据。

- [ ] **步骤 4：重新生成 Sapphire 运行时并做打包前检查**

运行：

```powershell
node scripts/build-widget-runtime.mjs
node --test widgets/netease-lyrics-glass/tests
```

预期：生成的 `widgets/netease-lyrics-glass/app.runtime.js` 与源码版本一致，测试全部 PASS。网页预览专属文件不被 `package-widget.ps1` 的正式清单要求。

- [ ] **步骤 5：检查工作区并 Commit**

运行：

```powershell
git status --short
```

预期：只包含本次预览功能的已知文件；不包含 `dist/`、`bin/`、`obj/`、本地缓存、凭据或用户隐私数据。

```powershell
git add widgets/netease-lyrics-glass docs/user-guide.md
git commit -m "test: 完成透明歌词视觉预览回归验证"
```

---

## 规格覆盖度自检

- 透明背景：任务 4 的 `styles.css` 和任务 5 的壁纸模拟区覆盖。
- 外文原文在上、中文翻译在下：任务 1 的 slot 数据、任务 4 的 DOM/CSS 覆盖。
- 下一句位置不变：任务 1 的稳定 slot 测试和任务 4 的隐藏占位行覆盖。
- 中日英独立字体：任务 3 的消息模型、任务 4 的语言 span、任务 5 的三个选择器覆盖。
- 宽度和高度独立调节：任务 3 的规范化测试、任务 5 的控制器和 UI 覆盖。
- 艺术字体预览选择：任务 5 的样式卡片和选择摘要覆盖。
- 不使用外部未知字体：任务 6 文档和设置边界覆盖。
- 不改变识别/桥接：文件清单明确排除 Bridge，任务 7 回归验证覆盖。

## 计划自检

- 已删除“只写待定”的实现步骤，所有代码行为使用明确字段、函数名、命令和预期输出描述。
- `selectDisplayLines` 新字段与任务 4 使用的 `currentSlot`、`nextSlot` 保持一致。
- 预览消息统一使用 `type: 'netease-lyrics-visual-preview'`，父页/iframe 通过该类型通信。
- 正式组件与预览页的存储边界明确，未把预览临时状态混入旧设置键。
