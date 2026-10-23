import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Input, Rate, Select, Table, Tag } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import SupplierFormFields, { newSupplierContact } from './SupplierFormFields';
import { supplierInitialValues, supplierPayload } from './SupplierDetail';
import { companyLabel } from '../../utils/lists';
import { EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import useDebounced from '../../utils/useDebounced';
import { useAuth } from '../../context/AuthContext';
import { isAdmin, isViewer } from '../../utils/access';

const PHASES = [1, 2, 3].map((n) => ({ value: n, label: `Phase ${n}` }));
const HALLS = Array.from({ length: 21 }, (_, i) => ({ value: i + 1, label: `Hall ${i + 1}` })); // D67: halls 1-21

// "Guangdong 广东", as the buyers read the province on the fair's documents.
const provinceName = (p) => [p.name_en, p.name_zh].filter(Boolean).join(' ');

// D66: a viewer (LECTEUR) gets the suppliers shared with its companies, read-only.
export default function Suppliers() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { user } = useAuth();
  const viewer = isViewer(user);
  const admin = isAdmin(user);
  const [rows, setRows] = useState([]);
  // D66: only the provinces of at least one supplier, reloaded with the list (a new supplier can add one).
  const [provinces, setProvinces] = useState([]);
  const [companies, setCompanies] = useState([]);
  // D60: the search applies as you type; "Réinitialiser" and each clear (×) empty the filters at once.
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [filters, setFilters] = useState({}); // province_id, phase, hall (D66: through the booths)
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null); // the supplier being edited

  const query = JSON.stringify({ q: q || undefined, ...filters });
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [list, used] = await Promise.all([
        axios.get(`${API_BASE_URL}/suppliers`, { params: JSON.parse(query) }),
        axios.get(`${API_BASE_URL}/suppliers/provinces`),
      ]);
      setRows(list.data.data);
      setProvinces(used.data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des fournisseurs'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (admin) axios.get(`${API_BASE_URL}/companies`).then((r) => setCompanies(r.data.data)).catch(() => {});
  }, [admin]);

  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value ?? undefined }));

  // The supplier, then its contact and the contact's WeChat QR code when the form has them (D52).
  // Once the supplier is saved, a refused contact does not undo it: the message says what is
  // missing, and the supplier page opens to finish it.
  const createSupplier = async (values) => {
    const res = await axios.post(`${API_BASE_URL}/suppliers`, supplierPayload(values));
    const id = res.data.data.id;
    const contact = newSupplierContact(values);
    if (contact) {
      try {
        const { wechat_qr: wechatQr, ...fields } = contact;
        const created = await axios.post(`${API_BASE_URL}/suppliers/${id}/contacts`, fields);
        if (wechatQr) {
          await axios.put(`${API_BASE_URL}/suppliers/${id}/contacts/${created.data.data.id}/wechat-qr`, { content: wechatQr });
        }
      } catch (err) {
        message.warning(`Fournisseur enregistré, mais pas tout le contact : ${apiError(err, 'erreur')}`);
      }
    }
    return id;
  };

  const visitPct = (r) => (r.booth_visit_pct === null ? -1 : Number(r.booth_visit_pct));

  // D40: design from Claude Design ("Fournisseurs", version A).
  const columns = [
    { title: 'N°', dataIndex: 'supplier_no', width: 70, sorter: (a, b) => a.supplier_no - b.supplier_no },
    {
      title: 'Nom', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v, r) => <Link to={`/fournisseurs/${r.id}`}>{v}</Link>,
    },
    {
      title: 'Province', dataIndex: 'province',
      render: (v, r) => {
        const p = provinces.find((x) => x.id === r.province_id);
        return p ? provinceName(p) : v || '—';
      },
    },
    { title: 'Téléphone', dataIndex: 'phone', responsive: ['md'], render: (v) => v || '—' },
    {
      title: 'Note', dataIndex: 'rating', width: 150, sorter: (a, b) => (a.rating || 0) - (b.rating || 0),
      render: (v) => (v ? <Rate disabled value={v} style={{ fontSize: 14 }} /> : <span className="text-muted small">Non noté</span>),
    },
    { title: 'Booths', dataIndex: 'nbr_booths', width: 80, align: 'right', responsive: ['lg'] },
    {
      title: '% visités', dataIndex: 'booth_visit_pct', width: 110, align: 'right', sorter: (a, b) => visitPct(a) - visitPct(b),
      render: (v) => (v === null
        ? <span className="text-muted">—</span>
        : <Tag color={Number(v) === 100 ? 'green' : Number(v) > 0 ? 'blue' : 'default'} className="m-0">{v} %</Tag>),
    },
    {
      title: 'Produits', dataIndex: 'products_count', width: 100, align: 'right', responsive: ['lg'],
      sorter: (a, b) => a.products_count - b.products_count,
    },
    admin && {
      title: 'Partagé avec', dataIndex: 'shared_company_ids', responsive: ['md'],
      render: (ids) => (ids?.length
        ? ids.map((id) => {
          const c = companies.find((x) => x.id === id);
          return <Tag key={id} color="purple" className="mb-1">{c ? companyLabel(c) : `Société ${id}`}</Tag>;
        })
        : <span className="text-secondary small">Non partagé</span>),
    },
    !viewer && {
      title: '', key: 'actions', width: 110, align: 'right',
      render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(r)}>Modifier</Button>,
    },
  ].filter(Boolean);

  return (
    <>
      <PageHeader title={viewer ? 'Fournisseurs partagés' : 'Fournisseurs'} chip="Foire de Canton"
        subtitle={viewer
          ? 'Les fournisseurs partagés avec vos sociétés, leurs contacts, booths et produits (lecture seule)'
          : 'Fournisseurs du groupe, leurs contacts, booths et produits'}
        actions={viewer ? null : <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Nouveau fournisseur</Button>} />
      <div className="sc-filters">
        <Input prefix={<SearchOutlined />} placeholder="Rechercher par nom ou téléphone" allowClear style={{ width: 280 }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select prefix={<span className="sc-label">Province :</span>} placeholder="Toutes" allowClear showSearch optionFilterProp="label"
          style={{ width: 260 }} value={filters.province_id} onChange={set('province_id')}
          notFoundContent="Aucun fournisseur n'a de province"
          options={provinces.map((p) => ({ value: p.id, label: provinceName(p) }))} />
        <Select prefix={<span className="sc-label">Phase :</span>} placeholder="Toutes" allowClear style={{ width: 170 }}
          value={filters.phase} onChange={set('phase')} options={PHASES} />
        <Select prefix={<span className="sc-label">Hall :</span>} placeholder="Tous" allowClear showSearch optionFilterProp="label"
          style={{ width: 170 }} value={filters.hall} onChange={set('hall')} options={HALLS} />
        <Button type="link" icon={<ReloadOutlined />} className="fw-semibold px-1"
          onClick={() => { setSearch(''); setFilters({}); }}>Réinitialiser</Button>
        {!loading && !loadError && (
          <span className="sc-counter ms-lg-auto"><strong>{rows.length} fournisseur{rows.length > 1 ? 's' : ''}</strong></span>
        )}
      </div>
      {(filters.phase || filters.hall) && (
        <div className="small text-secondary mb-2">Fournisseurs qui ont un booth {filters.hall ? `au hall ${filters.hall}` : ''}{filters.phase && filters.hall ? ', ' : ''}{filters.phase ? `en phase ${filters.phase}` : ''}.</div>
      )}
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle"
        scroll={{ x: true }} pagination={{ pageSize: 20 }} />

      {!viewer && (
        <>
          <FormModal open={!!editing} title="Modifier le fournisseur" width={640} initialValues={supplierInitialValues(editing, admin)}
            onCancel={() => setEditing(null)}
            onSubmit={(values) => axios.put(`${API_BASE_URL}/suppliers/${editing.id}`, supplierPayload(values))}
            onSaved={() => { setEditing(null); message.success('Fournisseur modifié'); load(); }}>
            <SupplierFormFields />
          </FormModal>

          <FormModal open={creating} title="Nouveau fournisseur" width={640}
            onCancel={() => setCreating(false)}
            onSubmit={createSupplier}
            onSaved={(id) => {
              setCreating(false);
              message.success('Fournisseur créé');
              navigate(`/fournisseurs/${id}`);
            }}>
            <SupplierFormFields withContact />
          </FormModal>
        </>
      )}
    </>
  );
}
