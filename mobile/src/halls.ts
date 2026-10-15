// D48: the hall plan is laid out like the official one (365.cantonfair.org.cn/en-US/exhibition-hall-map):
// the API gives one row per section and area (A = halls 1-8, B = 9-13, C = 14-16, D = 17-21), already
// in the plan's order, with the codes as written there ("14.4, 15.4, 16.4", "5.0(Outdoor Open Area)").
// Same as the web app (frontend/src/utils/fairPlan.js).

export const AREAS = ['A', 'D', 'C', 'B']; // the order of the site's legend

// All the codes of a section in a phase (its rows of every area), or '' when none.
export const sectionHalls = (rows: { phase: number; section: string; halls: string | null }[], phase: number, section: string) =>
  rows.filter((r) => r.phase === phase && r.section === section && r.halls).map((r) => r.halls).join(', ');
