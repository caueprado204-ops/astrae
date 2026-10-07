/** Remove citações [S#] que não correspondem a fontes efetivamente consultadas. */
export function sanitizeCitations(text: string, known: Set<string>) {
  const removed: string[] = [];
  const answer = text.replace(/\[((?:S\d+)(?:\s*,\s*S\d+)*)\]/g, (_m, inner: string) => {
    const ids = inner.split(/\s*,\s*/).filter((id) => { if (known.has(id)) return true; removed.push(id); return false; });
    return ids.length ? `[${ids.join(", ")}]` : "";
  });
  const cited = new Set<string>();
  for (const m of answer.matchAll(/\[((?:S\d+)(?:\s*,\s*S\d+)*)\]/g)) m[1].split(/\s*,\s*/).forEach((id) => cited.add(id));
  return { answer, removed, cited };
}
