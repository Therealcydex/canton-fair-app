// D47: the halls of a section, as typed in the fair's notation ("14.3, 14.4, 1.1Y, 9.0 (extérieur)"),
// shown one line per hall: "Hall 14 · étages 3, 4". Same logic as the web app
// (frontend/src/utils/fairPlan.js formatHalls).
//   14.3          hall 14, floor 3
//   1.1Y          hall 1, zone Y of floor 1
//   9.0           hall 9, ground level; "(extérieur)" makes it the outdoor area
//   (…) other notes ("Friendship Hall", "à vérifier") are kept at the end of the hall's line
// A part that does not follow the notation is shown as typed, on its own line.

interface Hall {
  floors: number[];
  zoneY: number[];
  ground: boolean;
  outdoor: boolean;
  notes: string[];
}

// "a, b (c, d), e" -> ["a", "b (c, d)", "e"]: commas inside parentheses stay.
function splitParts(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const plural = (word: string, n: number) => (n > 1 ? `${word}s` : word);

export function formatHalls(text?: string | null): string[] {
  if (!text) return [];
  const halls = new Map<number, Hall>();
  const loose: string[] = [];
  for (const part of splitParts(text)) {
    const m = /^(\d{1,2})\.(\d)(Y?)\s*(?:\((.*)\))?$/i.exec(part);
    if (!m) {
      loose.push(part);
      continue;
    }
    const n = Number(m[1]);
    const floor = Number(m[2]);
    const notes = (m[4] || '').split(',').map((s) => s.trim()).filter(Boolean);
    const outdoor = notes.some((s) => /^ext[ée]rieur$/i.test(s));
    const h = halls.get(n) || { floors: [], zoneY: [], ground: false, outdoor: false, notes: [] };
    if (floor === 0) {
      if (outdoor) h.outdoor = true;
      else h.ground = true;
    } else if (m[3]) {
      if (!h.zoneY.includes(floor)) h.zoneY.push(floor);
    } else if (!h.floors.includes(floor)) {
      h.floors.push(floor);
    }
    for (const note of notes) if (!/^ext[ée]rieur$/i.test(note) && !h.notes.includes(note)) h.notes.push(note);
    halls.set(n, h);
  }
  const lines = [...halls.entries()].sort(([a], [b]) => a - b).map(([n, h]) => {
    const where: string[] = [];
    const floors = [...h.floors].sort((a, b) => a - b);
    const zoneY = [...h.zoneY].sort((a, b) => a - b);
    if (floors.length) where.push(`${plural('étage', floors.length)} ${floors.join(', ')}`);
    if (zoneY.length) where.push(`zone Y ${plural('étage', zoneY.length)} ${zoneY.join(', ')}`);
    if (h.ground) where.push('rez-de-chaussée');
    if (h.outdoor) where.push('extérieur');
    return `Hall ${n} · ${where.join(' · ')}${h.notes.length ? ` (${h.notes.join(', ')})` : ''}`;
  });
  return [...lines, ...loose];
}
