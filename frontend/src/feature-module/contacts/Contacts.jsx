import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Input, Popconfirm, Select, Space, Table } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import WechatQr from '../suppliers/WechatQr';
import ContactFormFields, { contactPayload } from './ContactFormFields';

const QR_FILTERS = [
  { value: '1', label: 'Avec QR code' },
  { value: '0', label: 'Sans QR code' },
];

// The current filters as query parameters (empty ones left out), shared by the list, the CSV
// export and the QR sheet so all three show the same contacts.
export const contactParams = ({ q, supplier_id: supplierId, has_qr: hasQr }) => {
  const params = {};
  if (q) params.q = q;
  if (supplierId) params.supplier_id = supplierId;
  if (hasQr) params.has_qr = hasQr;
  return params;
};

// The name the server gives the CSV file (Content-Disposition), or a default one.
const fileName = (header) => /filename="([^"]+)"/.exec(header || '')?.[1] || 'contacts.csv';

// Every contact of every supplier (BF17): search, filters, CSV export, QR code sheet.
// Changes go through the supplier routes, where the contact rules live.
export default function Contacts() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, row = edit
  const [exporting, setExporting] = useState(false);

  const query = JSON.stringify(contactParams(filters));
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/contacts`, { params: JSON.parse(query) });
      setRows(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des contacts'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
  }, []);

  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value || undefined }));

  const remove = async (c) => {
    try {
      await axios.delete(`${API_BASE_URL}/suppliers/${c.supplier_id}/contacts/${c.id}`);
      message.success('Contact supprimé');
      load();
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  // Downloaded through axios so the token goes with the request; saved under the server's name.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/contacts/export`, { params: JSON.parse(query), responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName(res.headers['content-disposition']);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      // A refusal comes back as a blob too: read its JSON message.
      let msg = null;
      try { msg = JSON.parse(await err.response.data.text()).message; } catch { /* not JSON */ }
      message.error(msg || apiError(err, "Erreur lors de l'export"));
    } finally {
      setExporting(false);
    }
  };

  const printQr = () => navigate(`/contacts/qr?${new URLSearchParams(JSON.parse(query))}`);

  const columns = [
    { title: 'N°', dataIndex: 'id', width: 70, sorter: (a, b) => a.id - b.id },
    {
      title: 'Fournisseur', dataIndex: 'supplier_name',
      sorter: (a, b) => a.supplier_name.localeCompare(b.supplier_name, 'fr'),
      render: (v, c) => (
        <>
          <Link to={`/fournisseurs/${c.supplier_id}`}>{v}</Link>
          <div className="text-muted small">n° {c.supplier_id}</div>
        </>
      ),
    },
    {
      title: 'Nom', dataIndex: 'name', render: (v) => v || '—',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || '', 'fr'),
    },
    { title: 'Téléphone', dataIndex: 'phone', render: (v) => (v ? <a href={`tel:${v}`}>{v}</a> : '—') },
    { title: 'E-mail', dataIndex: 'email', responsive: ['md'], render: (v) => (v ? <a href={`mailto:${v}`}>{v}</a> : '—') },
    {
      title: 'QR code WeChat', dataIndex: 'wechat_qr', width: 230,
      render: (_, c) => <WechatQr supplierId={c.supplier_id} contact={c} onChanged={load} />,
    },
    {
      title: '', key: 'actions', width: 190,
      render: (_, c) => (
        <Space>
          <Button size="small" onClick={() => setEditing(c)}>Modifier</Button>
          <Popconfirm title="Supprimer ce contact ?" description="Sa photo de QR code est supprimée aussi."
            okText="Supprimer" cancelText="Annuler" onConfirm={() => remove(c)}>
            <Button size="small" danger>Supprimer</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space className="mb-3 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">Contacts</h1>
        <Space wrap>
          <Button onClick={exportCsv} loading={exporting}>Exporter (CSV)</Button>
          <Button onClick={printQr}>Imprimer les QR codes</Button>
          <Button type="primary" onClick={() => setEditing({})}>Nouveau contact</Button>
        </Space>
      </Space>
      <Space className="mb-3" wrap>
        <Input.Search placeholder="Nom, téléphone, e-mail, fournisseur" allowClear style={{ width: 280 }}
          onSearch={set('q')} />
        <Select placeholder="Fournisseur" allowClear showSearch optionFilterProp="label" style={{ width: 240 }}
          options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (n° ${s.id})` }))} onChange={set('supplier_id')} />
        <Select placeholder="QR code WeChat" allowClear style={{ width: 160 }} options={QR_FILTERS} onChange={set('has_qr')} />
      </Space>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle"
        scroll={{ x: true }} pagination={{ pageSize: 50, showTotal: (n) => `${n} contact(s)` }}
        locale={{ emptyText: 'Aucun contact' }} />

      <FormModal open={!!editing} title={editing?.id ? 'Modifier le contact' : 'Nouveau contact'} initialValues={editing}
        onCancel={() => setEditing(null)}
        onSubmit={(values) => (editing.id
          ? axios.put(`${API_BASE_URL}/suppliers/${editing.supplier_id}/contacts/${editing.id}`, contactPayload(values))
          : axios.post(`${API_BASE_URL}/suppliers/${values.supplier_id}/contacts`, contactPayload(values)))}
        onSaved={() => { setEditing(null); message.success('Contact enregistré'); load(); }}>
        <ContactFormFields suppliers={editing?.id ? undefined : suppliers} />
      </FormModal>
    </>
  );
}
