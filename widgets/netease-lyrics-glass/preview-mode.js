const SUPPORTED_PREVIEW_MODES = new Set(['wide', 'stacked', 'compact']);

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
        { startMs: 0, original: '所有故事都有回声', translation: 'Every story has an echo' },
        { startMs: 12000, original: '我听见风穿过城市', translation: 'I hear the wind passing through the city' },
        { startMs: 18000, original: '把漫长的夜点亮', translation: 'And light up the long night' }
      ]
    }
  };
}
