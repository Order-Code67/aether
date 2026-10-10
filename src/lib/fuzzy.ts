/** Simple subsequence fuzzy score; higher is better. -1 = no match. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();
  let ti = 0;
  let score = 0;
  let consecutive = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]!;
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    if (found === ti) consecutive += 1;
    else consecutive = 0;
    score += 10 + consecutive * 5;
    if (found === 0 || /[/\\._\-\s]/.test(t[found - 1] ?? "")) {
      score += 8;
    }
    ti = found + 1;
  }
  score -= Math.max(0, t.length - q.length);
  return score;
}

export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
): T[] {
  if (!query.trim()) return items;
  return items
    .map((item) => ({ item, score: fuzzyScore(query, getText(item)) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
