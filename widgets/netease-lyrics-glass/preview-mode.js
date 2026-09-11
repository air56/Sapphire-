const SUPPORTED_PREVIEW_MODES = new Set(['wide', 'stacked', 'compact']);
const VISUAL_PREVIEW_PARENT = '/visual-style.html';

export function getVisualPreviewMode(search, referrer, isEmbedded) {
  if (!isEmbedded) return null;
  const mode = new URLSearchParams(search).get('__sapphireVisualPreview');
  if (!SUPPORTED_PREVIEW_MODES.has(mode)) return null;

  try {
    return new URL(referrer).pathname.endsWith(VISUAL_PREVIEW_PARENT) ? mode : null;
  } catch {
    return null;
  }
}
export function createVisualPreviewSnapshot(mode) {
  if (!SUPPORTED_PREVIEW_MODES.has(mode)) return null;

  return {
    trackSessionId: `visual-preview-${mode}`,
    bridge: { status: 'ready' },
    track: { title: 'Liquid Glass · 视觉预览', artist: 'Sapphire' },
    playback: { state: 'paused', positionMs: 12000 },
    lyrics: {
      status: 'ready',
      lines: [
        { startMs: 0, original: 'Every story has an echo', translation: '每个故事都有回响' },
        { startMs: 12000, original: 'Moonlight on the sea', translation: '月光洒落海面' },
        { startMs: 18000, original: 'The night grows bright', translation: '长夜渐亮' }
      ]
    }
  };
}
