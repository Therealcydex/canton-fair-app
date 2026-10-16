import { useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, Spin, Table, Tabs } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { AREAS } from '../../utils/fairPlan';
import PageHeader from '../../components/PageHeader';

// D48: the sections of a phase grouped as on the official plan: Zone A, D, C, B, each section with
// its codes in that zone, in the plan's order (the API's); a section in two zones shows in both.
// Sections without halls come last.
const groupByArea = (rows) => {
  const groups = AREAS.map((area) => ({ key: area, title: `Zone ${area}`, rows: [] }));
  const other = { key: '?', title: 'Autres', rows: [] };
  const empty = { key: 'none', title: 'Sans hall', rows: [] };
  rows.forEach((row) => {
    if (!row.halls) empty.rows.push(row);
    else (groups.find((g) => g.key === row.area) || other).rows.push(row);
  });
  return [...groups, other, empty].filter((g) => g.rows.length);
};

const PHASES = [
  { phase: 1, label: 'Phase 1 · 15-19 oct.' },
  { phase: 2, label: 'Phase 2 · 23-27 oct.' },
  { phase: 3, label: 'Phase 3 · 31 oct.-4 nov.' },
];

const columns = [
  { title: 'Section', dataIndex: 'section' },
  { title: 'Halls', dataIndex: 'halls', width: 420, render: (v) => v || <span className="text-muted">—</span> },
];

// D42/D51: the hall plan of the fair, the official plan of the session laid out like it (D48).
// Read only, for everyone: it is loaded from the official plan (npm run db:add-fair-plan).
export default function FairPlan() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/fair-plan`)
      .then(({ data }) => setRows(data.data))
      .catch((err) => setError(apiError(err, 'Erreur lors du chargement du plan')));
  }, []);

  // Sections, not rows: a section in two zones counts once.
  const sections = rows ? new Set(rows.map((r) => `${r.phase}|${r.section}`)).size : 0;
  const known = rows ? new Set(rows.filter((r) => r.halls).map((r) => `${r.phase}|${r.section}`)).size : 0;
  return (
    <>
      <PageHeader title="Plan du salon" chip="140e session"
        subtitle={`Les halls de chaque section pour la session en cours${rows ? ` (${known} section(s) sur ${sections} renseignée(s))` : ''}.`} />
      <Alert type="info" showIcon className="mb-3"
        message={<>Plan officiel de la 140e session (<a href="https://365.cantonfair.org.cn/en-US/exhibition-hall-map?phase=first" target="_blank" rel="noreferrer">site Canton Fair 365</a>).</>} />
      {error && <Alert type="error" message={error} showIcon className="mb-3" />}
      <Tabs items={PHASES.map((p) => ({
        key: String(p.phase),
        label: p.label,
        children: !rows && !error ? <Spin /> : groupByArea((rows || []).filter((r) => r.phase === p.phase)).map((g) => (
          <div key={g.key} className="mb-4">
            <h2 className="h6 mb-2">{g.title}</h2>
            <Table rowKey={(r) => `${g.key}|${r.section}`} columns={columns} size="small"
              dataSource={g.rows} pagination={false} scroll={{ x: true }} />
          </div>
        )),
      }))} />
    </>
  );
}
