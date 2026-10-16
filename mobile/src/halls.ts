// D48: the hall plan is laid out like the official one (365.cantonfair.org.cn/en-US/exhibition-hall-map):
// the API gives one row per section and area (A = halls 1-8, B = 9-13, C = 14-16, D = 17-21), already
// in the plan's order, with the codes as written there ("14.4, 15.4, 16.4", "5.0(Outdoor Open Area)").
// Same as the web app (frontend/src/utils/fairPlan.js).

export const AREAS = ['A', 'D', 'C', 'B']; // the order of the site's legend


// D50: a booth code typed with 1-digit numbers ("10.3A8-9") as the codes are stored ("10.3A08-09"),
// so a search finds the booth either way. Same as the server (backend/utils/halls.js).
export const padBoothNumbers = (text: string) => text
  .replace(/([A-Za-z])(\d)(?!\d)/g, (_m, letter: string, digit: string) => `${letter}0${digit}`)
  .replace(/-(\d)(?!\d)/g, (_m, digit: string) => `-0${digit}`);
