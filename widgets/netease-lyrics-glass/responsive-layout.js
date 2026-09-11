export function selectResponsiveLayout(width, height) {
  const resolvedWidth = Number.isFinite(width) ? width : 0;
  const resolvedHeight = Number.isFinite(height) ? height : 0;

  if (resolvedHeight < 105) return 'compact';
  return resolvedWidth >= 560 ? 'wide' : 'stacked';
}
