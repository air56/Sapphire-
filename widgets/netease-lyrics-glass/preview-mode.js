const SUPPORTED_PREVIEW_MODES = new Set(['wide', 'stacked', 'compact', 'interactive']);
const VISUAL_PREVIEW_PARENT = '/visual-style.html';

export function getVisualPreviewMode(search, referrer, isEmbedded) {
  if (!isEmbedded) return null;
  const mode = new URLSearchParams(search).get('__sapphireVisualPreview');
  if (!SUPPORTED_PREVIEW_MODES.has(mode)) return null;

  // WebEngine and strict referrer policies may omit the referrer even for a
  // real iframe. In that case the explicit preview query and embedded check
  // still provide an opt-in signal. When a referrer is available, retain the
  // dedicated preview-page guard so normal widget embeds cannot opt in by
  // accident.
  if (!referrer) return mode;
  try {
    return new URL(referrer).pathname.endsWith(VISUAL_PREVIEW_PARENT) ? mode : null;
  } catch {
    return mode;
  }
}

export function createVisualPreviewSnapshot(mode) {
  if (!SUPPORTED_PREVIEW_MODES.has(mode)) return null;

  return {
    trackSessionId: `visual-preview-${mode}`,
    bridge: { status: 'ready' },
    track: { title: '透明歌词层 · 视觉预览', artist: 'Sapphire' },
    playback: { state: 'paused', positionMs: 12000 },
    lyrics: {
      status: 'ready',
      lines: [
        { startMs: 0, original: 'もう一度だけ', translation: '再一次就好' },
        { startMs: 5000, original: 'Every story has an echo', translation: '每个故事都有回响' },
        { startMs: 12000, original: 'Moonlight on the sea', translation: '月光洒落海面' },
        { startMs: 18000, original: 'The night grows bright', translation: '长夜渐亮' },
        { startMs: 24000, original: '優しい彗星', translation: '温柔的彗星' },
        { startMs: 30000, original: 'I will remember the light', translation: '我会记住那道光' },
        { startMs: 36000, original: '下一句没有翻译', translation: null }
      ]
    }
  };
}
