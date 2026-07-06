export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function paletteMatchesQuery(colorNames: string[], query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const normalizedQuery = normalize(trimmed);
  return colorNames.some((name) => normalize(name).includes(normalizedQuery));
}
