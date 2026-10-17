import { categoryIdOf, categoryLabel, categoryOptions, categoryParent, categoryPath } from './lists';

const P3 = 'Phase 3 (Oct.31 - Nov.4)';
const rows = [
  { id: 1, phase: P3, category: 'Health & Recreation', section: 'Food', sub_category: 'Bakery food' },
  { id: 2, phase: P3, category: 'Health & Recreation', section: 'Food', sub_category: 'Honey' },
  { id: 3, phase: P3, category: 'Health & Recreation', section: 'Rural Vitalization', sub_category: 'Rural Vitalization' },
];

test('a section without sub-categories is the last level of the menu', () => {
  const [health] = categoryOptions(rows, 3);
  expect(health.children).toEqual([
    { value: 'Food', label: 'Food', children: [{ value: 1, label: 'Bakery food' }, { value: 2, label: 'Honey' }] },
    { value: 3, label: 'Rural Vitalization' },
  ]);
  expect(categoryPath(rows, 3)).toEqual(['Health & Recreation', 3]);
  expect(categoryPath(rows, 2)).toEqual(['Health & Recreation', 'Food', 2]);
  expect(categoryIdOf(['Health & Recreation', 3])).toBe(3);
  expect(categoryIdOf(['Health & Recreation', 'Food', 2])).toBe(2);
  expect(categoryIdOf(undefined)).toBeNull();
});

test('a bare section is not repeated in the labels', () => {
  expect(categoryLabel(rows[0])).toBe('Health & Recreation › Food › Bakery food');
  expect(categoryLabel(rows[2])).toBe('Health & Recreation › Rural Vitalization');
  expect(categoryLabel({ sub_category: null })).toBe('');
  expect(categoryParent(rows[0])).toBe('Health & Recreation › Food');
  expect(categoryParent(rows[2])).toBe('Health & Recreation');
});
