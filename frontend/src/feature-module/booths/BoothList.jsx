import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Popconfirm, Table, Tag, Tooltip } from 'antd';
import { LinkOutlined, PlusOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import BoothFormFields, { boothPayload } from './BoothFormFields';
import { categoryPath, useList } from '../../utils/lists';

const two = (n) => String(n).padStart(2, '0'); // D50: booth numbers on 2 digits, as on the badges
export const boothNumber = (b) => (b.num_start == null ? '—' : `${two(b.num_start)}${b.num_end == null ? '' : `-${two(b.num_end)}`}`);

// Table of booths for the given API filters (D49: laid out like the Stitch "Booths" screen), with
// "Modifier" and "Supprimer" on each row and the status tag that switches visited / to visit.
// Used by the booth pages and by the supplier page. A page that shows "Nouveau booth" in its header
// passes createOpen / onCreateOpenChange; otherwise the list shows the button itself. onLoaded
// receives the rows, for the page's counters.
export default function BoothList({ filters, supplierId, planning, hideSupplier, onChanged, createOpen, onCreateOpenChange, onLoaded }) {
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

  const query = JSON.stringify({ ...filters, supplier_id: supplierId });
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/booths`, { params: JSON.parse(query) });
      setRows(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des booths'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { onLoaded?.(rows); }, [rows, onLoaded]);

  const changed = () => { load(); onChanged?.(); };

  const setVisited = async (booth, visited) => {
    try {
      await axios.patch(`${API_BASE_URL}/booths/${booth.id}/visited`, { visited });
      message.success(`${booth.booth_code} : ${visited ? 'visité' : 'à visiter'}`);
      changed();
    } catch (err) {
      message.error(apiError(err, "Erreur lors de l'enregistrement"));
    }
  };

  const remove = async (booth) => {
    try {
      await axios.delete(`${API_BASE_URL}/booths/${booth.id}`);
      message.success(`Booth ${booth.booth_code} supprimé`);
      changed();
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  const columns = [
    {
      title: 'Code booth', dataIndex: 'booth_code', fixed: 'left',
      render: (v, b) => (
        <Link to={`/booths/${b.id}`} className="booth-code">{v} <LinkOutlined /></Link>
      ),
    },
    { title: 'Phase', dataIndex: 'phase', render: (v) => `Phase ${v}` },
    { title: 'Hall', dataIndex: 'hall', render: (v) => `Hall ${v}` },
    { title: 'Étage', dataIndex: 'floor', align: 'center' },
    { title: 'Lettre', dataIndex: 'letter', align: 'center', render: (v) => <strong>{v || '—'}</strong> },
    { title: 'Numéro', key: 'number', render: (_, b) => boothNumber(b) },
    { title: 'Zone', dataIndex: 'zone', align: 'center', render: (v) => v || '—' }, // D50
    !hideSupplier && {
      title: 'Fournisseur rattaché', dataIndex: 'supplier_name',
      render: (v, b) => (
        <>
          {b.supplier_id ? <Link to={`/fournisseurs/${b.supplier_id}`} className="text-body">{v}</Link> : '—'}
          {b.sub_category && (
            <Tooltip title={`${b.category} › ${b.section}`}>
              <div className="small text-secondary">{b.sub_category}</div>
            </Tooltip>
          )}
        </>
      ),
    },
    {
      title: 'Produits', dataIndex: 'nbr_products', align: 'center',
      render: (v) => {
        const n = Number(v) || 0;
        return <Tag color={n ? 'blue' : 'default'} className="m-0">{n} produit{n > 1 ? 's' : ''}</Tag>;
      },
    },
    {
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
    {
      title: 'Actions', key: 'actions', align: 'right',
      render: (_, b) => (
        <span className="text-nowrap">
          <Button type="link" size="small" className="fw-semibold" onClick={() => setEditing(b)}>Modifier</Button>
          <Popconfirm title={`Supprimer le booth ${b.booth_code} ?`}
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
      {createOpen === undefined && (
        <div className="d-flex justify-content-end mb-2">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Nouveau booth</Button>
        </div>
      )}
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" className="sc-table"
        scroll={{ x: 'max-content' }}
        pagination={{
          pageSize, showSizeChanger: true, pageSizeOptions: [20, 50, 100], onShowSizeChange: (_, size) => setPageSize(size),
          showTotal: (total, [from, to]) => <>Affichage de <strong>{from} à {to}</strong> sur <strong>{total}</strong> booth{total > 1 ? 's' : ''}</>,
        }}
        locale={{ emptyText: planning ? 'Aucun booth à visiter' : 'Aucun booth' }} />

      <FormModal open={!!editing} title={editing ? `Modifier le booth ${editing.booth_code}` : ''} width={640}
        initialValues={editing && { ...editing, visited: !!editing.visited, category_path: categoryPath(categories, editing.category_id) }}
        onCancel={() => setEditing(null)}
        onSubmit={(values) => axios.put(`${API_BASE_URL}/booths/${editing.id}`, boothPayload(values))}
        onSaved={() => { setEditing(null); message.success('Booth modifié'); changed(); }}>
        <BoothFormFields lockSupplier={!!supplierId} />
      </FormModal>

      <FormModal open={creating} title="Nouveau booth" width={640}
        initialValues={{ supplier_id: supplierId, visited: false, floor: 1 }}
        onCancel={() => setCreating(false)}
        onSubmit={(values) => axios.post(`${API_BASE_URL}/booths`, boothPayload(values))}
        onSaved={(res) => {
          setCreating(false);
          message.success(`Booth ${res.data.data.booth_code} créé`);
          if (supplierId) changed(); else navigate(`/booths/${res.data.data.id}`);
        }}>
        <BoothFormFields lockSupplier={!!supplierId} />
      </FormModal>
    </>
  );
}
