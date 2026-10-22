import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Empty, Popconfirm, Spin, Table, Tag, Tooltip } from 'antd';
import { CheckOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import BoothFormFields, { boothInitialValues, boothPayload } from './BoothFormFields';
import { useAuth } from '../../context/AuthContext';
import { isViewer } from '../../utils/access';
import { categoryParent, useList } from '../../utils/lists';
import { boothLabel } from '../../utils/format';

const two = (n) => String(n).padStart(2, '0'); // D50: booth numbers on 2 digits, as on the badges
export const boothNumber = (b) => (b.num_start == null ? '—' : `${two(b.num_start)}${b.num_end == null ? '' : `-${two(b.num_end)}`}`);

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const hallLabel = (h) => `${h.zone ? `Zone ${h.zone} · ` : ''}Hall ${h.hall}`;

// D66: the booths by phase, then by hall, as walked on the fair floor.
// Returns [{ phase, rows, halls: [{ hall, zone, rows }] }], phases and halls in order.
const byPhaseHall = (rows) => {
  const phases = new Map();
  for (const b of rows) {
    if (!phases.has(b.phase)) phases.set(b.phase, { phase: b.phase, rows: [], halls: new Map() });
    const p = phases.get(b.phase);
    if (!p.halls.has(b.hall)) p.halls.set(b.hall, { hall: b.hall, zone: b.zone, rows: [] });
    p.rows.push(b);
    p.halls.get(b.hall).rows.push(b);
  }
  return [...phases.values()].sort((a, b) => a.phase - b.phase)
    .map((p) => ({ ...p, halls: [...p.halls.values()].sort((a, b) => a.hall - b.hall) }));
};

// The booths grouped by phase and hall, as walked on the fair floor, with each hall's progress.
function BoothChecklist({ rows, loading, saving, onToggle }) {
  if (loading && !rows.length) return <div className="text-center py-5"><Spin /></div>;
  if (!rows.length) return <Empty description="Aucun booth à visiter" className="py-4" />;
  return (
    <div className="booth-check">
      {byPhaseHall(rows).map((p) => (
        <section key={p.phase} className="mb-4">
          <h2 className="h5 mb-2">Phase {p.phase}</h2>
          {p.halls.map((h) => {
            const list = h.rows;
            const done = list.filter((b) => b.visited).length;
            return (
              <section key={h.hall} className="mb-3">
                <div className="d-flex justify-content-between align-items-baseline mb-1">
                  <span className="sc-label">{hallLabel(h)}</span>
                  <span className="small fw-semibold text-secondary">{list.length - done} restant{list.length - done > 1 ? 's' : ''}</span>
                </div>
                <div className="sc-progress mb-2"><span style={{ width: `${(done / list.length) * 100}%`, background: 'var(--sc-success)' }} /></div>
                {[...list.filter((b) => !b.visited), ...list.filter((b) => b.visited)].map((b) => (
                  <div key={b.id} className={`booth-check-row ${b.visited ? 'is-visited' : ''}`}>
                    <Link to={`/booths/${b.id}`} className="booth-check-link">
                      <span className="booth-code booth-check-code">{boothLabel(b.phase, b.booth_code)}</span>
                      <span className="overflow-hidden">
                        <span className="d-block fw-semibold text-body text-truncate">{b.supplier_name || 'Sans fournisseur'}</span>
                        <span className="d-block small text-secondary text-truncate">{b.sub_category || 'Sans catégorie'}</span>
                      </span>
                    </Link>
                    <button type="button" className="booth-check-btn" disabled={saving.includes(b.id)} onClick={() => onToggle(b)}
                      aria-label={b.visited ? 'Remettre à visiter' : 'Marquer comme visité'} aria-pressed={!!b.visited}>
                      <CheckOutlined />
                    </button>
                  </div>
                ))}
              </section>
            );
          })}
        </section>
      ))}
    </div>
  );
}

// "1/3 visités" and its bar.
function Progress({ rows }) {
  const done = rows.filter((b) => b.visited).length;
  return (
    <span className="d-inline-flex align-items-center gap-2 small fw-semibold text-nowrap">
      <span className={done === rows.length ? 'text-success' : 'text-secondary'}>{done}/{rows.length} visité{done > 1 ? 's' : ''}</span>
      <span className="sc-progress d-inline-block" style={{ width: 90 }}>
        <span style={{ width: `${(done / rows.length) * 100}%`, background: 'var(--sc-success)' }} />
      </span>
    </span>
  );
}

// D66: "À visiter" on a computer: one table per hall, under its phase, with the booths visited out
// of the planned ones; the visited booths stay, at the bottom of their hall. The hall and zone
// columns are left out (the heading gives them).
function BoothGroups({ rows, loading, columns }) {
  if (loading && !rows.length) return <div className="text-center py-5"><Spin /></div>;
  if (!rows.length) return <Empty description="Aucun booth à visiter" className="py-4" />;
  const shown = columns.filter((c) => !['hall', 'zone'].includes(c.dataIndex));
  return byPhaseHall(rows).map((p) => (
    <section key={p.phase} className="sc-panel p-3 mb-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h2 className="h5 m-0">Phase {p.phase}</h2>
        <span className="d-inline-flex flex-wrap align-items-center gap-3">
          <span className="small text-secondary">{plural(p.rows.length, 'booth')} · {plural(p.halls.length, 'hall')}</span>
          <Progress rows={p.rows} />
        </span>
      </div>
      {p.halls.map((h) => (
        <div key={h.hall} className="mb-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
            <span className="sc-label">{hallLabel(h)} · {plural(h.rows.length, 'booth')}</span>
            <Progress rows={h.rows} />
          </div>
          <Table rowKey="id" columns={shown} size="small" pagination={false}
            dataSource={[...h.rows.filter((b) => !b.visited), ...h.rows.filter((b) => b.visited)]}
            rowClassName={(b) => (b.visited ? 'opacity-50' : '')}
            className="sc-table" scroll={{ x: 'max-content' }} />
        </div>
      ))}
    </section>
  ));
}

// Table of booths for the given API filters (D49: laid out like the Stitch "Booths" screen), with
// "Modifier" and "Supprimer" on each row and the status tag that switches visited / to visit.
// Used by the booth pages and by the supplier page. A page that shows "Nouveau booth" in its header
// passes createOpen / onCreateOpenChange; otherwise the list shows the button itself. onLoaded
// receives the rows, for the page's counters.
// `checklist` (D52, "À visiter" on a phone): the booths as cards grouped by hall, each with a big ✓
// that marks it visited (tap again to undo); the visited booths go to the bottom of their hall.
export default function BoothList({ filters, supplierId, planning, checklist, onChanged, createOpen, onCreateOpenChange, onLoaded }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [ownCreating, setOwnCreating] = useState(false);
  const creating = createOpen ?? ownCreating;
  const setCreating = onCreateOpenChange ?? setOwnCreating;
  const [editing, setEditing] = useState(null); // the booth being edited
  const [pageSize, setPageSize] = useState(20);
  const categories = useList('canton-categories');
  const { user } = useAuth();
  const viewer = isViewer(user); // D66: read-only, the booths of its shared suppliers

  const query = JSON.stringify({ ...filters, supplier_id: supplierId });
  // Only the answer to the latest request is shown: when the filters change quickly (the page
  // switches to the phone checklist right after its first render), an older answer can come last.
  const latest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/booths`, { params: JSON.parse(query) });
      if (request === latest.current) setRows(data.data);
    } catch (err) {
      if (request === latest.current) setLoadError(apiError(err, 'Erreur lors du chargement des booths'));
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { onLoaded?.(rows); }, [rows, onLoaded]);

  const changed = () => { load(); onChanged?.(); };

  const setVisited = async (booth, visited) => {
    try {
      await axios.patch(`${API_BASE_URL}/booths/${booth.id}/visited`, { visited });
      message.success(`${boothLabel(booth.phase, booth.booth_code)} : ${visited ? 'visité' : 'à visiter'}`);
      changed();
    } catch (err) {
      message.error(apiError(err, "Erreur lors de l'enregistrement"));
    }
  };

  // Checklist: the card changes at once; a refusal puts it back and shows the server's message.
  const [saving, setSaving] = useState([]);
  const toggleVisited = async (booth) => {
    const visited = !booth.visited;
    const setOne = (v) => setRows((list) => list.map((b) => (b.id === booth.id ? { ...b, visited: v ? 1 : 0 } : b)));
    setSaving((ids) => [...ids, booth.id]);
    setOne(visited);
    try {
      await axios.patch(`${API_BASE_URL}/booths/${booth.id}/visited`, { visited });
    } catch (err) {
      setOne(!visited);
      message.error(apiError(err, "Erreur lors de l'enregistrement"));
    } finally {
      setSaving((ids) => ids.filter((id) => id !== booth.id));
    }
  };

  const remove = async (booth) => {
    try {
      await axios.delete(`${API_BASE_URL}/booths/${booth.id}`);
      message.success(`Booth ${boothLabel(booth.phase, booth.booth_code)} supprimé`);
      changed();
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  const columns = [
    {
      title: 'Code booth', dataIndex: 'booth_code', fixed: 'left',
      render: (v, b) => (
        <Link to={`/booths/${b.id}`} className="booth-code">{boothLabel(b.phase, v)} <LinkOutlined /></Link>
      ),
    },
    { title: 'Édition', dataIndex: 'edition', align: 'center' }, // D64
    { title: 'Hall', dataIndex: 'hall', render: (v) => `Hall ${v}` },
    { title: 'Étage', dataIndex: 'floor', align: 'center' },
    { title: 'Lettre', dataIndex: 'letter', align: 'center', render: (v) => <strong>{v || '—'}</strong> },
    { title: 'Numéro', key: 'number', render: (_, b) => boothNumber(b) },
    { title: 'Zone', dataIndex: 'zone', align: 'center', render: (v) => v || '—' }, // D50
    {
      // D58: no supplier column (the booth page shows it); the category keeps its own column.
      title: 'Catégorie', dataIndex: 'sub_category',
      render: (v, b) => (v ? <Tooltip title={categoryParent(b)}><span className="small">{v}</span></Tooltip> : '—'),
    },
    {
      title: 'Produits', dataIndex: 'nbr_products', align: 'center',
      render: (v) => {
        const n = Number(v) || 0;
        return <Tag color={n ? 'blue' : 'default'} className="m-0">{n} produit{n > 1 ? 's' : ''}</Tag>;
      },
    },
    viewer ? {
      title: 'Statut', dataIndex: 'visited',
      render: (v) => <Tag color={v ? 'default' : 'orange'} className="m-0">{v ? 'Visité' : 'À visiter'}</Tag>,
    } : {
      title: 'Statut', dataIndex: 'visited',
      render: (v, b) => (
        <Tooltip title={v ? 'Cliquer pour remettre à visiter' : 'Cliquer pour marquer visité'}>
          <Tag color={v ? 'default' : 'orange'} className="m-0 booth-status" role="button" tabIndex={0}
            onClick={() => setVisited(b, !v)} onKeyDown={(e) => e.key === 'Enter' && setVisited(b, !v)}>
            {v ? 'Visité' : 'À visiter'}
          </Tag>
        </Tooltip>
      ),
    },
    { title: 'Commentaire', dataIndex: 'comment', ellipsis: true, render: (v) => v || '—' },
    !viewer && {
      title: 'Actions', key: 'actions', align: 'right',
      render: (_, b) => (
        <span className="text-nowrap">
          <Button type="link" size="small" className="fw-semibold" onClick={() => setEditing(b)}>Modifier</Button>
          <Popconfirm title={`Supprimer le booth ${boothLabel(b.phase, b.booth_code)} ?`}
            description={Number(b.nbr_products) ? 'Ses produits sont gardés, sans booth.' : undefined}
            okText="Supprimer" okButtonProps={{ danger: true }} cancelText="Annuler" onConfirm={() => remove(b)}>
            <Button type="link" size="small" danger className="fw-semibold">Supprimer</Button>
          </Popconfirm>
        </span>
      ),
    },
  ].filter(Boolean);

  return (
    <>
      {createOpen === undefined && !viewer && (
        <div className="d-flex justify-content-end mb-2">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Nouveau booth</Button>
        </div>
      )}
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      {checklist ? (
        <BoothChecklist rows={rows} loading={loading} saving={saving} onToggle={toggleVisited} />
      ) : planning ? (
        <BoothGroups rows={rows} loading={loading} columns={columns} />
      ) : (
        <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" className="sc-table"
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize, showSizeChanger: true, pageSizeOptions: [20, 50, 100], onShowSizeChange: (_, size) => setPageSize(size),
            showTotal: (total, [from, to]) => <>Affichage de <strong>{from} à {to}</strong> sur <strong>{total}</strong> booth{total > 1 ? 's' : ''}</>,
          }}
          locale={{ emptyText: planning ? 'Aucun booth à visiter' : 'Aucun booth' }} />
      )}

      {/* D62: a viewer has no forms (they would also load lists it may not read). */}
      {!viewer && (
        <>
          <FormModal open={!!editing} title={editing ? `Modifier le booth ${boothLabel(editing.phase, editing.booth_code)}` : ''} width={640}
            initialValues={boothInitialValues(editing, categories)}
            onCancel={() => setEditing(null)}
            onSubmit={(values) => axios.put(`${API_BASE_URL}/booths/${editing.id}`, boothPayload(values))}
            onSaved={() => { setEditing(null); message.success('Booth modifié'); changed(); }}>
            <BoothFormFields lockSupplier={!!supplierId} />
          </FormModal>

          <FormModal open={creating} title="Nouveau booth" width={640}
            initialValues={{ visited: false, floor: 1, edition: 140 }}
            onCancel={() => setCreating(false)}
            // From a supplier's page the booth is that supplier's. Elsewhere the form picks or creates one.
            onSubmit={(values) => axios.post(`${API_BASE_URL}/booths`, boothPayload({ ...values, supplier_id: supplierId ?? values.supplier_id }))}
            onSaved={(res) => {
              setCreating(false);
              message.success(`Booth ${boothLabel(res.data.data.phase, res.data.data.booth_code)} créé`);
              if (supplierId) changed(); else navigate(`/booths/${res.data.data.id}`);
            }}>
            <BoothFormFields withSupplier={!supplierId} />
          </FormModal>
        </>
      )}
    </>
  );
}
