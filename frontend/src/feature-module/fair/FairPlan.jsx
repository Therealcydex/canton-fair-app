import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, App, Input, Spin, Table, Tabs } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/access';
import { AREAS, hallsOf } from '../../utils/fairPlan';

// D48: the sections of a phase grouped as on the official plan: Area A, D, C, B, each section with
// its codes in that area, in the plan's order (the API's); a section in two areas shows in both.
// Sections without halls come last.
const groupByArea = (rows) => {
  const groups = AREAS.map((area) => ({ key: area, title: `Area ${area}`, rows: [] }));
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

// The admin's cell: saved on Enter or when leaving the field, only if it changed.
function HallsInput({ row, onSave }) {
  const [value, setValue] = useState(row.halls || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(row.halls || ''), [row.halls]);
  const save = async () => {
    if (value.trim() === (row.halls || '')) return;
    setSaving(true);
    if (!(await onSave(row, value.trim()))) setValue(row.halls || '');
    setSaving(false);
  };
  return (
    <Input value={value} onChange={(e) => setValue(e.target.value)} onBlur={save} onPressEnter={(e) => e.target.blur()}
      disabled={saving} maxLength={255} placeholder="ex. 14.3, 14.4, 15.4" allowClear />
  );
}

// D42: the hall plan of the fair: which halls hold each exhibition section in this session, laid
// out like the official plan (D48). Everyone reads it; the admin can correct a section (the field
// holds all its codes, whatever the area).
export default function FairPlan() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const admin = isAdmin(user);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/fair-plan`);
      setRows(data.data);
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement du plan'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (row, halls) => {
    try {
      await axios.put(`${API_BASE_URL}/fair-plan`, { phase: row.phase, section: row.section, halls });
      message.success(halls ? `Halls enregistrés : ${row.section}` : `Halls retirés : ${row.section}`);
      await load();
      return true;
    } catch (err) {
      message.error(apiError(err, "Erreur lors de l'enregistrement"));
      return false;
    }
  };

  const columns = [
    { title: 'Section', dataIndex: 'section' },
    {
      title: 'Halls', dataIndex: 'halls', width: 420,
      // The admin's field holds all the codes of the section (every area); the server splits them.
      render: (v, row) => (admin
        ? <HallsInput row={{ ...row, halls: hallsOf(rows || [], row.phase, row.section) }} onSave={save} />
        : (v || <span className="text-muted">—</span>)),
    },
  ];

  const known = rows ? rows.filter((r) => r.halls).length : 0;
  return (
    <>
      <h1 className="h4 mb-2">Plan du salon</h1>
      <p className="text-muted mb-3">
        Les halls de chaque section pour la session en cours{rows ? ` (${known} section(s) sur ${rows.length} renseignée(s))` : ''}.
      </p>
      <Alert type="info" showIcon className="mb-3"
        message={<>Plan officiel de la 140e session (<a href="https://365.cantonfair.org.cn/en-US/exhibition-hall-map?phase=first" target="_blank" rel="noreferrer">site Canton Fair 365</a>).{admin ? ' Vous pouvez corriger une section : le champ contient tous ses halls.' : ''}</>} />
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
