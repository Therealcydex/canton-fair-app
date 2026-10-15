// D48: the halls of a section, in the notation of the fair's official plan
// (365.cantonfair.org.cn/en-US/exhibition-hall-map): "14.4, 15.4, 16.4", "5.0(Outdoor Open Area)",
// "Friendship Hall(21.2)". The area comes from the hall number, as on the plan:
// A = halls 1-8, B = 9-13, C = 14-16, D = 17-21. The apps show the same areas
// (frontend/src/utils/fairPlan.js, mobile/src/halls.ts).
const AREAS = ['A', 'D', 'C', 'B']; // the order of the plan's legend

const areaOf = (code) => {
  const m = /(\d{1,2})\.\d/.exec(code);
  if (!m) return '';
  const hall = Number(m[1]);
  if (hall >= 1 && hall <= 8) return 'A';
  if (hall >= 9 && hall <= 13) return 'B';
  if (hall >= 14 && hall <= 16) return 'C';
  if (hall >= 17 && hall <= 21) return 'D';
  return '';
};

// "a, b(c, d), e" -> ["a", "b(c, d)", "e"]: commas inside parentheses stay.
const splitCodes = (text) => {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of String(text || '')) {
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

// The codes of a section in each area, in the order they appear: [{ area: 'A', halls: '5.0(…), 8.0' }].
// A code without a hall number goes to area ''.
const splitByArea = (text) => {
  const byArea = new Map();
  for (const code of splitCodes(text)) {
    const area = areaOf(code);
    byArea.set(area, [...(byArea.get(area) || []), code]);
  }
  return [...byArea].map(([area, codes]) => ({ area, halls: codes.join(', ') }));
};

module.exports = { AREAS, areaOf, splitCodes, splitByArea };
