import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Form, Image, Select, Space, Table, Tag, Tooltip } from 'antd';
import { API_BASE_URL, fileUrl } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { boothLabel, formatPrice } from '../../utils/format';
import { STATUS } from '../../utils/decision';
import { companyLabel } from '../../utils/lists';
import FormModal from '../../components/FormModal';
import ProductFormFields, { productPayload } from './ProductFormFields';
import { EditOutlined } from '@ant-design/icons';

// "New product", opened from the page headers (products page, supplier page, booth page: boothId).
export function NewProductModal({ open, supplierId, boothId, onClose }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  return (
    <FormModal open={open} title="Nouveau produit" width={720}
      initialValues={{ supplier_id: supplierId, booth_id: boothId, shipping_type: 'FOB' }}
      onCancel={onClose}
      onSubmit={(values) => axios.post(`${API_BASE_URL}/products`, productPayload(values))}
      onSaved={(res) => {
        onClose();
        message.success('Produit créé : ajoutez ses photos');
        navigate(`/produits/${res.data.data.id}`);
      }}>
      <ProductFormFields lockSupplier={!!supplierId} />
    </FormModal>
  );
}

// One colour per company, in the order of the company list, so a company keeps its colour.
const COMPANY_COLORS = ['blue', 'purple', 'magenta', 'cyan', 'gold', 'green', 'volcano', 'geekblue'];
const sharedIds = (p) => (p.shared_company_ids ? p.shared_company_ids.split(',').map(Number) : []);

// Table of products for the given API filters. With `companies` (the products page, D40, design
// from Claude Design "Produits" version A), rows can be selected and shared with several of the
// group's companies at once ("Partager avec…"), or one by one ("Partager").
export default function ProductList({ filters, supplierId, companies }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState(null); // the products being shared
  const [editing, setEditing] = useState(null); // the product being edited
  const sharing = !!companies;

  const query = JSON.stringify({ ...filters, supplier_id: supplierId });
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/products`, { params: JSON.parse(query) });
      setRows(data.data);
      const ids = new Set(data.data.map((p) => p.id));
      setSelected((sel) => sel.filter((id) => ids.has(id)));
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des produits'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const colorOf = (id) => COMPANY_COLORS[Math.max(0, (companies || []).findIndex((c) => c.id === id)) % COMPANY_COLORS.length];
  const companyById = (id) => (companies || []).find((c) => c.id === id);
  const single = target && target.length === 1 ? rows.find((p) => p.id === target[0]) : null;

  const columns = [
    {
      title: 'Photo', dataIndex: 'cover_url', width: 72,
      render: (url) => (url
        ? <Image src={fileUrl(url)} width={48} height={48} style={{ objectFit: 'cover', borderRadius: 6 }} preview={false} />
        : <div className="bg-light border rounded" style={{ width: 48, height: 48 }} />),
    },
    {
      title: 'Nom', dataIndex: 'name',
      render: (v, p) => (
        <>
          <Link to={`/produits/${p.id}`} className="fw-medium">{v}</Link>
          {p.supplier_ref && <div className="text-muted small">Réf. {p.supplier_ref}</div>}
        </>
      ),
    },
    !supplierId && { title: 'Fournisseur', dataIndex: 'supplier_name', responsive: ['md'], render: (v) => v || '—' },
    {
      title: 'Booth', dataIndex: 'booth_code', width: 140, responsive: ['md'],
      render: (v, p) => (v ? <Link to={`/booths/${p.booth_id}`}>{boothLabel(p.booth_phase, v)}</Link> : '—'),
    },
    {
      title: 'Décision', dataIndex: 'status', width: 130,
      render: (v, p) => {
        const tag = <Tag color={STATUS[v]?.color} className="m-0">{STATUS[v]?.label || v}</Tag>;
        return p.decision_note ? <Tooltip title={p.decision_note}>{tag}</Tooltip> : tag;
      },
    },
    {
      title: 'Prix', dataIndex: 'price', align: 'right',
      render: (v, p) => <span className="text-nowrap">{formatPrice(v)}{p.unit ? <span className="text-muted"> / {p.unit}</span> : null}</span>,
    },
    { title: 'MOQ', dataIndex: 'moq', width: 90, align: 'right', render: (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('fr-FR')) },
    {
      title: 'Expédition', dataIndex: 'shipping_type', width: 110, responsive: ['md'],
      render: (v, p) => (v ? <Tooltip title={p.shipping_name}><Tag color="geekblue" className="m-0">{v}</Tag></Tooltip> : '—'),
    },
    {
      title: 'Partagé avec', dataIndex: 'shared_with', responsive: ['lg'],
      render: (v, p) => {
        const ids = sharedIds(p);
        if (!ids.length) return <span className="text-muted small">Non partagé</span>;
        if (!sharing) return v;
        return (
          <Space size={[0, 4]} wrap>
            {ids.map((id) => {
              const c = companyById(id);
              return <Tag key={id} color={colorOf(id)}>{c ? companyLabel(c) : `Société ${id}`}</Tag>;
            })}
          </Space>
        );
      },
    },
    {
      title: '', key: 'actions', width: sharing ? 200 : 110, align: 'right',
      render: (_, p) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(p)}>Modifier</Button>
          {sharing && <Button size="small" onClick={() => setTarget([p.id])}>Partager</Button>}
        </Space>
      ),
    },
  ].filter(Boolean);

  // One product: the list replaces its shares. Several: added to, or replacing, theirs.
  const saveShares = (values) => (single
    ? axios.put(`${API_BASE_URL}/products/${single.id}/shares`, { company_ids: values.companies || [] })
    : axios.post(`${API_BASE_URL}/products/shares`, { product_ids: target, company_ids: values.companies || [], mode: values.mode }));

  return (
    <>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      {sharing && selected.length > 0 && (
        <Alert className="mb-3" type="info"
          message={(
            <Space className="w-100 justify-content-between" wrap>
              <span>
                <span className="fw-medium">{selected.length}</span> produit{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}
              </span>
              <Space>
                <Button size="small" onClick={() => setSelected([])}>Désélectionner</Button>
                <Button size="small" type="primary" onClick={() => setTarget(selected)}>Partager avec…</Button>
              </Space>
            </Space>
          )} />
      )}
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle"
        scroll={{ x: true }} pagination={{ pageSize: 30 }}
        rowSelection={sharing ? { selectedRowKeys: selected, onChange: setSelected, preserveSelectedRowKeys: false } : undefined}
        locale={{ emptyText: filters?.mine ? 'Aucun produit partagé avec votre société' : 'Aucun produit' }} />

      <FormModal open={!!editing} title="Modifier le produit" width={720} initialValues={editing}
        onCancel={() => setEditing(null)}
        onSubmit={(values) => axios.put(`${API_BASE_URL}/products/${editing.id}`, productPayload(values))}
        onSaved={() => { setEditing(null); message.success('Produit modifié'); load(); }}>
        <ProductFormFields lockSupplier={!!supplierId} />
      </FormModal>

      {sharing && (
        <FormModal open={!!target} width={520}
          title={single ? `Partager « ${single.name} »` : `Partager ${target?.length || 0} produits`}
          initialValues={{ companies: single ? sharedIds(single) : [], mode: 'add' }}
          onCancel={() => setTarget(null)}
          onSubmit={saveShares}
          onSaved={() => {
            message.success(single ? 'Partages enregistrés' : `${target.length} produits partagés`);
            if (!single) setSelected([]);
            setTarget(null);
            load();
          }}>
          <Form.Item name="companies" label="Sociétés du groupe"
            rules={single ? [] : [{ required: true, message: 'Choisissez au moins une société' }]}>
            <Select mode="multiple" allowClear showSearch optionFilterProp="label" placeholder="Choisir les sociétés"
              options={companies.map((c) => ({ value: c.id, label: companyLabel(c) }))} />
          </Form.Item>
          {!single && (
            <Form.Item name="mode" label="Partages existants">
              <Select options={[
                { value: 'add', label: 'Ajouter aux partages existants' },
                { value: 'replace', label: 'Remplacer les partages existants' },
              ]} />
            </Form.Item>
          )}
          <div className="text-muted small">
            {single && 'Retirez une société pour arrêter le partage. '}
            Les acheteurs des sociétés choisies verront ces produits dans « Partagés avec ma société ».
          </div>
        </FormModal>
      )}
    </>
  );
}
