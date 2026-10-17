import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/config';

// The reference lists of schema v2 (provinces, shipping types, Canton Fair categories) never
// change while the app runs: each is loaded once and shared by every screen.
const cache = {};

const load = (name) => {
  if (!cache[name]) {
    cache[name] = axios.get(`${API_BASE_URL}/lists/${name}`).then((r) => r.data.data);
    cache[name].catch(() => delete cache[name]); // try again next time
  }
  return cache[name];
};

export function useList(name) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let alive = true;
    load(name).then((data) => alive && setRows(data)).catch(() => {});
    return () => { alive = false; };
  }, [name]);
  return rows;
}

// "Phase 2 (Oct.23 - 27)" -> 2
export const phaseNumber = (phase) => Number(/^Phase (\d)/.exec(phase || '')?.[1]) || null;

// A section listed without sub-categories (D41: one row whose sub-category repeats the section's
// name) is the last level of the menu, not "Hardware > Hardware > Hardware".
const isBareSection = (rows, r) => r.sub_category === r.section
  && !rows.some((x) => x.id !== r.id && x.phase === r.phase && x.category === r.category && x.section === r.section);

// The flat category rows -> a Cascader tree: category > section > sub-category (value = row id),
// limited to one fair phase when `phase` is given. A bare section is a leaf whose value is its id.
export const categoryOptions = (rows, phase) => {
  const tree = new Map();
  for (const r of rows) {
    if (phase && phaseNumber(r.phase) !== Number(phase)) continue;
    if (!tree.has(r.category)) tree.set(r.category, new Map());
    const sections = tree.get(r.category);
    if (!sections.has(r.section)) sections.set(r.section, []);
    sections.get(r.section).push(r);
  }
  return [...tree].map(([category, sections]) => ({
    value: category,
    label: category,
    children: [...sections].map(([section, subs]) => (subs.length === 1 && isBareSection(rows, subs[0])
      ? { value: subs[0].id, label: section }
      : { value: section, label: section, children: subs.map((r) => ({ value: r.id, label: r.sub_category })) })),
  }));
};

// Category row id -> the Cascader path [category, section, id], or [category, id] for a bare section.
export const categoryPath = (rows, id) => {
  const r = rows.find((x) => x.id === id);
  if (!r) return undefined;
  return isBareSection(rows, r) ? [r.category, r.id] : [r.category, r.section, r.id];
};

// A category row, or a booth with its category, as "Category › Section › Sub-category"; a bare
// section is not repeated: "Health & Recreation › Rural Vitalization" (D54). '' without category.
export const categoryLabel = (r) => (r?.sub_category
  ? [r.category, r.section, r.sub_category !== r.section && r.sub_category].filter(Boolean).join(' › ') : '');

// What sits above the sub-category, for a tooltip over it: the category alone for a bare section.
export const categoryParent = (r) => (r.sub_category === r.section ? r.category : `${r.category} › ${r.section}`);

// Cascader path -> the category row id: always its last value.
export const categoryIdOf = (path) => (path?.length ? path[path.length - 1] : null);

// Company with its branch: "Groupe - Tunis".
export const companyLabel = (c) => (c.branch ? `${c.name} - ${c.branch}` : c.name);
