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

// The flat category rows -> a Cascader tree: category > section > sub-category (value = row id),
// limited to one fair phase when `phase` is given.
export const categoryOptions = (rows, phase) => {
  const tree = new Map();
  for (const r of rows) {
    if (phase && phaseNumber(r.phase) !== Number(phase)) continue;
    if (!tree.has(r.category)) tree.set(r.category, new Map());
    const sections = tree.get(r.category);
    if (!sections.has(r.section)) sections.set(r.section, []);
    sections.get(r.section).push({ value: r.id, label: r.sub_category });
  }
  return [...tree].map(([category, sections]) => ({
    value: category,
    label: category,
    children: [...sections].map(([section, subs]) => ({ value: section, label: section, children: subs })),
  }));
};

// Category row id -> the Cascader path [category, section, id].
export const categoryPath = (rows, id) => {
  const r = rows.find((x) => x.id === id);
  return r ? [r.category, r.section, r.id] : undefined;
};

// Company with its branch: "Groupe - Tunis".
export const companyLabel = (c) => (c.branch ? `${c.name} - ${c.branch}` : c.name);
