const PLAYING_STATE_NAMES = new Set(['playing', 'play']);

function normalizedPositionMs(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export function isPlayingState(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value === 0;

  const normalized = String(value ?? '').trim().toLowerCase();
  return PLAYING_STATE_NAMES.has(normalized) || normalized === '0';
}

export function effectivePlaybackPositionMs(playback, anchor, nowMs = performance.now()) {
  const positionMs = normalizedPositionMs(playback?.positionMs);
  if (!isPlayingState(playback?.state) || !anchor) return positionMs;

  const elapsedMs = Math.max(0, Number(nowMs) - Number(anchor.monotonicMs));
  return Math.max(0, positionMs + elapsedMs);
}

/**
 * Maintains a local monotonic playback clock between sparse or stale SMTC snapshots.
 * A playing snapshot with the same reported position must not reset the clock.
 */
export function createPlaybackClock({ resyncThresholdMs = 1500 } = {}) {
  const threshold = Math.max(0, Number(resyncThresholdMs) || 0);
  let state = {
    sessionId: null,
    playbackState: null,
    basePositionMs: 0,
    anchorMonotonicMs: null,
    lastReportedPositionMs: null
  };

  function update(sessionId, playback, nowMs = performance.now()) {
    const positionMs = normalizedPositionMs(playback?.positionMs);
    const playing = isPlayingState(playback?.state);
    const sessionChanged = state.sessionId !== sessionId;

    if (sessionChanged || !playing || !isPlayingState(state.playbackState)) {
      state = {
        sessionId,
        playbackState: playback?.state ?? null,
        basePositionMs: positionMs,
        anchorMonotonicMs: playing ? nowMs : null,
        lastReportedPositionMs: positionMs
      };
      return;
    }

    const estimatedPositionMs = state.anchorMonotonicMs === null
      ? state.basePositionMs
      : state.basePositionMs + Math.max(0, nowMs - state.anchorMonotonicMs);
    const repeatedPosition = state.lastReportedPositionMs === positionMs;

    // Keep the monotonic estimate for repeated stale reports. Resync only when
    // a new report clearly indicates a seek or a large timeline discontinuity.
    if (!repeatedPosition && Math.abs(positionMs - estimatedPositionMs) > threshold) {
      state.basePositionMs = positionMs;
      state.anchorMonotonicMs = nowMs;
    }

    state.playbackState = playback?.state ?? null;
    state.lastReportedPositionMs = positionMs;
  }

  function position(playback, nowMs = performance.now()) {
    const positionMs = normalizedPositionMs(playback?.positionMs);
    if (!isPlayingState(playback?.state) || state.anchorMonotonicMs === null) return positionMs;

    return Math.max(0, state.basePositionMs + Math.max(0, nowMs - state.anchorMonotonicMs));
  }

  function reset() {
    state = {
      sessionId: null,
      playbackState: null,
      basePositionMs: 0,
      anchorMonotonicMs: null,
      lastReportedPositionMs: null
    };
  }

  return { update, position, reset };
}

