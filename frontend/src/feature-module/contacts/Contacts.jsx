import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, App, Button, Form, Input, Popconfirm, Select, Table } from 'antd';
import { DownloadOutlined, PrinterOutlined, ReloadOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import PageHeader from '../../components/PageHeader';
import WechatQr, { QrPicker, QrThumb } from '../suppliers/WechatQr';
import ContactFormFields, { contactPayload } from './ContactFormFields';
import ContactCard, { openCardOnClick } from './ContactCard';
import ContactAvatar from '../../components/ContactAvatar';
import useDebounced from '../../utils/useDebounced';

const two = (n) => String(n).padStart(2, '0');

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
  const [urlParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  // Opened from a supplier page: /contacts?supplier_id=3 starts filtered on that supplier.
  const [filters, setFilters] = useState(() => {
    const supplierId = Number(urlParams.get('supplier_id'));
    return Number.isInteger(supplierId) && supplierId > 0 ? { supplier_id: supplierId } : {};
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, row = edit
  const [viewing, setViewing] = useState(null); // D63: the contact shown in its card
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim()); // D60: the search applies as you type
  const [pageSize, setPageSize] = useState(20);

  const query = JSON.stringify(contactParams({ ...filters, q }));
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/contacts`, { params: JSON.parse(query) });
      // N° is the line number (1, 2, 3…), in the server's order: the contact's id keeps the gaps
      // left by deleted contacts and stays internal.
      const numbered = data.data.map((c, i) => ({ ...c, n: i + 1 }));
      setRows(numbered);
      return numbered;
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des contacts'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
  }, []);

  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value || undefined }));

  // After a QR change in the edit form: reload the table and show the new QR code in the form.
  const qrChanged = async () => {
    const fresh = await load();
    const row = fresh?.find((c) => c.id === editing?.id);
    if (row) setEditing(row);
  };

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

  // A new contact, then its WeChat QR code when one was read in the form. If the QR code is
  // refused, the contact stays saved (no duplicate on a retry) and the message says so.
  const createContact = async (values) => {
    const res = await axios.post(`${API_BASE_URL}/suppliers/${values.supplier_id}/contacts`, contactPayload(values));
    if (values.wechat_qr) {
      try {
        await axios.put(`${API_BASE_URL}/suppliers/${values.supplier_id}/contacts/${res.data.data.id}/wechat-qr`, { content: values.wechat_qr });
      } catch (err) {
        message.warning(`Contact enregistré, mais pas son QR code : ${apiError(err, 'erreur')}`);
      }
    }
    return res;
  };

  const printQr = () => navigate(`/contacts/qr?${new URLSearchParams(JSON.parse(query))}`);

  // D49: columns of the Stitch "Contacts" screen.
  const columns = [
    { title: 'N°', dataIndex: 'n', width: 64, sorter: (a, b) => a.n - b.n, render: (v) => <span className="text-secondary fw-semibold">{two(v)}</span> },
    {
      title: 'Nom', dataIndex: 'name',
      render: (v, c) => (
        <span className="d-inline-flex align-items-center gap-2 text-nowrap">
          <ContactAvatar contact={c} size={36} />
          {v ? <span className="fw-semibold">{v}</span> : '—'}
        </span>
      ),
      sorter: (a, b) => (a.name || '').localeCompare(b.name || '', 'fr'),
    },
    {
      title: 'Fournisseur rattaché', dataIndex: 'supplier_name',
      sorter: (a, b) => a.supplier_name.localeCompare(b.supplier_name, 'fr'),
      render: (v, c) => (
        <span className="text-nowrap">
          <span className="sc-label me-2">N° {two(c.supplier_no)}</span>
          <Link to={`/fournisseurs/${c.supplier_id}`}>{v}</Link>
        </span>
      ),
    },
    { title: 'Téléphone mobile', dataIndex: 'phone', render: (v) => (v ? <a href={`tel:${v}`} className="text-body text-nowrap">{v}</a> : '—') },
    { title: 'E-mail professionnel', dataIndex: 'email', render: (v) => (v ? <a href={`mailto:${v}`}>{v}</a> : '—') },
    {
      title: 'QR code WeChat', dataIndex: 'wechat_qr', width: 130, align: 'center',
      render: (v) => <QrThumb value={v} />,
    },
    {
      title: 'Actions', key: 'actions', align: 'right',
      render: (_, c) => (
        <span className="text-nowrap">
          <Button type="link" size="small" className="fw-semibold" onClick={() => setEditing(c)}>Modifier</Button>
          <Popconfirm title="Supprimer ce contact ?" description="Sa photo de QR code est supprimée aussi."
            okText="Supprimer" okButtonProps={{ danger: true }} cancelText="Annuler" onConfirm={() => remove(c)}>
            <Button type="link" size="small" danger className="fw-semibold">Supprimer</Button>
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Répertoire terrain" title="Contacts" chip="WeChat"
        subtitle="Annuaire des contacts fournisseurs et leurs QR codes WeChat"
        actions={(
          <>
            <Button icon={<PrinterOutlined />} onClick={printQr}>Imprimer les QR codes</Button>
            <Button icon={<DownloadOutlined />} onClick={exportCsv} loading={exporting}>Exporter (CSV)</Button>
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => setEditing({})}>Nouveau contact</Button>
          </>
        )} />
      <div className="sc-filters">
        <Input prefix={<SearchOutlined />} placeholder="Rechercher par nom, téléphone, e-mail, fournisseur…" allowClear
          style={{ flex: '1 1 280px', maxWidth: 520 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select prefix={<span className="sc-label">Fournisseur :</span>} placeholder="Tous" allowClear showSearch optionFilterProp="label"
          style={{ width: 300 }} value={filters.supplier_id} onChange={set('supplier_id')}
          options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (n° ${s.supplier_no})` }))} />
        <Select prefix={<span className="sc-label">QR code WeChat :</span>} placeholder="Tous" allowClear style={{ width: 240 }}
          value={filters.has_qr} options={QR_FILTERS} onChange={set('has_qr')} />
        <Button type="link" icon={<ReloadOutlined />} className="fw-semibold px-1"
          onClick={() => { setFilters({}); setSearch(''); }}>Réinitialiser</Button>
        <span className="sc-counter ms-lg-auto">
          <span className="share-dot rounded-circle" style={{ background: 'var(--sc-accent)' }} />
          <strong>{rows.length} contact{rows.length > 1 ? 's' : ''}</strong> enregistré{rows.length > 1 ? 's' : ''}
        </span>
      </div>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" className="sc-table sc-table-clickable"
        onRow={openCardOnClick(setViewing)} // D63
        scroll={{ x: 'max-content' }}
        pagination={{
          pageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], onShowSizeChange: (_, size) => setPageSize(size),
          showTotal: (total, [from, to]) => <>Affichage de <strong>{from} à {to}</strong> sur <strong>{total}</strong> contact{total > 1 ? 's' : ''}</>,
        }}
        locale={{ emptyText: 'Aucun contact' }} />

      <ContactCard contact={viewing} onClose={() => setViewing(null)}
        onEdit={(c) => { setViewing(null); setEditing(c); }} />

      <FormModal open={!!editing} title={editing?.id ? 'Modifier le contact' : 'Nouveau contact'} initialValues={editing}
        icon={<UserAddOutlined />} className="sc-modal-dark" width={680}
        onCancel={() => setEditing(null)}
        onSubmit={(values) => (editing.id
          ? axios.put(`${API_BASE_URL}/suppliers/${editing.supplier_id}/contacts/${editing.id}`, contactPayload(values))
          : createContact(values))}
        onSaved={() => { setEditing(null); message.success('Contact enregistré'); load(); }}>
        <ContactFormFields suppliers={editing?.id ? undefined : suppliers} />
        {editing?.id ? (
          <Form.Item label="QR code WeChat" className="mt-3 mb-0"
            extra="Enregistré tout de suite, sans attendre le bouton « Enregistrer ».">
            <WechatQr supplierId={editing.supplier_id} contact={editing} onChanged={qrChanged} size={120} />
          </Form.Item>
        ) : (
          <Form.Item name="wechat_qr" label={<>QR code WeChat <span className="fw-normal text-secondary ms-1">(enregistré avec le contact)</span></>}
            className="mb-0">
            <QrPicker />
          </Form.Item>
        )}
      </FormModal>
    </>
  );
}
