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
