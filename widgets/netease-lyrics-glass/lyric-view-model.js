function asCodePoints(text) {
  return Array.from(String(text ?? ''));
}

export function truncateText(text, maxChars) {
  if (text == null || text === '') return null;
  const points = asCodePoints(text);
  const limit = Math.max(1, Number.parseInt(maxChars, 10) || 1);
  return points.length <= limit ? points.join('') : `${points.slice(0, Math.max(0, limit - 1)).join('')}…`;
}

function validLine(line) {
  return line && Number.isFinite(Number(line.startMs)) && String(line.original ?? '').trim() !== '';
}

export function selectDisplayLines(lines = [], positionMs = 0, maxChars = 56) {
  const usableLines = lines
    .filter(validLine)
    .map((line) => ({ ...line, startMs: Number(line.startMs) }))
    .sort((left, right) => left.startMs - right.startMs);
  const currentIndex = usableLines.reduce(
    (index, line, candidateIndex) => (line.startMs <= positionMs ? candidateIndex : index),
    -1
  );
  const current = currentIndex >= 0 ? usableLines[currentIndex] : null;
  const next = currentIndex < 0 ? (usableLines[0] ?? null) : (usableLines[currentIndex + 1] ?? null);

  const result = {
    currentOriginal: truncateText(current?.original, maxChars),
    currentTranslation: truncateText(current?.translation, maxChars),
    nextOriginal: truncateText(next?.original, maxChars)
  };
  Object.defineProperties(result, {
    currentSlot: { value: createSlot(current, 'current', currentIndex, maxChars), enumerable: false },
    nextSlot: { value: createSlot(next, 'next', currentIndex + 1, maxChars), enumerable: false }
  });
  return result;
}
function createSlot(line, role, index, maxChars) {
  if (!line) return null;
  return {
    original: truncateText(line.original, maxChars),
    translation: truncateText(line.translation, maxChars),
    hasTranslation: Boolean(String(line.translation ?? '').trim()),
    slotKey: `${role}-${index}`
  };
}


