import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, App, Input, Table, Tabs } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/access';
import { formatDateTime } from '../../utils/decision';

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

// D42: the hall plan of the fair: which halls hold each exhibition section in this session.
// Everyone reads it; the admin types the halls from the official printed plan.
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
    { title: 'Catégorie', dataIndex: 'category', width: 220, responsive: ['md'] },
    { title: 'Section', dataIndex: 'section' },
    {
      title: 'Halls', dataIndex: 'halls', width: 300,
      render: (v, row) => (admin ? <HallsInput row={row} onSave={save} /> : (v ? <b>{v}</b> : <span className="text-muted">—</span>)),
    },
    {
      title: 'Mis à jour', dataIndex: 'updated_at', width: 190, responsive: ['lg'],
      render: (v, row) => (v ? <span className="text-muted small">{row.updated_by_name || '—'}, {formatDateTime(v)}</span> : ''),
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
        message={admin
          ? "Recopiez les halls depuis le plan officiel de cette session (plan imprimé ou application du salon). Le plan du site cantonfair.org.cn est celui de la 137e session : les halls ont changé depuis."
          : "Les halls sont saisis par l'administrateur depuis le plan officiel de la session."} />
      {error && <Alert type="error" message={error} showIcon className="mb-3" />}
      <Tabs items={PHASES.map((p) => ({
        key: String(p.phase),
        label: p.label,
        children: (
          <Table rowKey={(r) => `${r.phase}|${r.section}`} columns={columns} loading={!rows && !error} size="small"
            dataSource={(rows || []).filter((r) => r.phase === p.phase)} pagination={false} scroll={{ x: true }} />
        ),
      }))} />
    </>
  );
}
