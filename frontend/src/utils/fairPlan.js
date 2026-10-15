import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/config';

// D42: the hall plan of the fair (section -> halls of the current session). Loaded by each screen
// that shows it, since the admin can change it at any time.
export function useFairPlan() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let alive = true;
    axios.get(`${API_BASE_URL}/fair-plan`).then((r) => alive && setRows(r.data.data)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return rows;
}

// The halls of a section in a phase, or null when the plan does not give them.
export const hallsOf = (plan, phase, section) =>
  plan.find((s) => s.phase === Number(phase) && s.section === section)?.halls || null;

// D42: a supplier's page on the fair's site, only cantonfair.org.cn or cantonfair.org (the server
// checks the same rule).
export const CANTON_FAIR_URL = /^https?:\/\/([^/?#]*\.)?cantonfair\.org(\.cn)?([/?#]|$)/i;

// D47: the halls of a section, as typed in the fair's notation ("14.3, 14.4, 1.1Y, 9.0 (extérieur)"),
// shown one line per hall: "Hall 14 · étages 3, 4". Same logic as the mobile app (src/halls.ts).
//   14.3   hall 14, floor 3          1.1Y   hall 1, zone Y of floor 1
//   9.0    hall 9, ground level; "(extérieur)" makes it the outdoor area
//   (…)    other notes ("Friendship Hall", "à vérifier") are kept at the end of the hall's line
// A part that does not follow the notation is shown as typed, on its own line.
const splitParts = (text) => {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
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
};

const plural = (word, n) => (n > 1 ? `${word}s` : word);
const OUTDOOR = /^ext[ée]rieur$/i;

export function formatHalls(text) {
  if (!text) return [];
  const halls = new Map();
  const loose = [];
  for (const part of splitParts(text)) {
    const m = /^(\d{1,2})\.(\d)(Y?)\s*(?:\((.*)\))?$/i.exec(part);
    if (!m) {
      loose.push(part);
      continue;
    }
    const n = Number(m[1]);
    const floor = Number(m[2]);
    const notes = (m[4] || '').split(',').map((s) => s.trim()).filter(Boolean);
    const h = halls.get(n) || { floors: [], zoneY: [], ground: false, outdoor: false, notes: [] };
    if (floor === 0) {
      if (notes.some((s) => OUTDOOR.test(s))) h.outdoor = true;
      else h.ground = true;
    } else if (m[3]) {
      if (!h.zoneY.includes(floor)) h.zoneY.push(floor);
    } else if (!h.floors.includes(floor)) {
      h.floors.push(floor);
    }
    notes.forEach((note) => { if (!OUTDOOR.test(note) && !h.notes.includes(note)) h.notes.push(note); });
    halls.set(n, h);
  }
  const lines = [...halls.entries()].sort(([a], [b]) => a - b).map(([n, h]) => {
    const where = [];
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
