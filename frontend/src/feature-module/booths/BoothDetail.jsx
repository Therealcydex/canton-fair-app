import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Col, Popconfirm, Row, Spin, Table, Tag } from 'antd';
import {
  ArrowRightOutlined, BankOutlined, CheckOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, ExportOutlined,
  InboxOutlined, MailOutlined, PhoneOutlined, PlusOutlined, ShopOutlined, UndoOutlined,
} from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import ProductThumb from '../../components/ProductThumb';
import ContactAvatar from '../../components/ContactAvatar';
import { apiError } from '../../utils/apiError';
import { STATUS } from '../../utils/decision';
import { ZONE_HALLS } from '../../utils/fairPlan';
import { boothLabel, formatPrice } from '../../utils/format';
import { useList } from '../../utils/lists';
import FormModal from '../../components/FormModal';
import { NewProductModal } from '../products/ProductList';
import { QrThumb } from '../suppliers/WechatQr';
import BoothFormFields, { boothInitialValues, boothPayload } from './BoothFormFields';
import { useAuth } from '../../context/AuthContext';
import { isViewer } from '../../utils/access';
import { boothNumber } from './BoothList';

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// A booth (BF07, BF08), laid out like the Stitch "Fiche Booth" screen (D49): where it is, its
// supplier with the contacts and their WeChat QR codes, and the products found there (D43).
// D62: a viewer (LECTEUR) reads a booth shared with its company: no change, no link to the
// supplier and product pages, and no decision (the server sends the booth with its products).
export default function BoothDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const viewer = isViewer(user);
  const { message } = App.useApp();
  const navigate = useNavigate();
  const categories = useList('canton-categories');
  const [booth, setBooth] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const [products, setProducts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/booths/${id}`);
      const b = data.data;
      setBooth(b);
      if (b.products) { // a viewer's booth comes with its products and supplier
        setProducts(b.products);
        setSupplier(b.supplier);
        return;
      }
      const [prods, sup] = await Promise.all([
        axios.get(`${API_BASE_URL}/products`, { params: { booth_id: b.id } }),
        b.supplier_id ? axios.get(`${API_BASE_URL}/suppliers/${b.supplier_id}`) : null,
      ]);
      setProducts(prods.data.data);
      setSupplier(sup ? sup.data.data : null);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement du booth'));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/booths/${id}`);
      message.success('Booth supprimé');
      navigate('/booths');
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  const setVisited = async (visited) => {
    try {
      await axios.patch(`${API_BASE_URL}/booths/${id}/visited`, { visited });
      message.success(visited ? 'Booth marqué visité' : 'Booth remis à visiter');
      load();
    } catch (err) {
      message.error(apiError(err, "Erreur lors de l'enregistrement"));
    }
  };

  if (loadError) return <Alert type="error" message={loadError} showIcon action={<Link to="/booths">Retour</Link>} />;
  if (!booth) return <div className="text-center py-5"><Spin /></div>;

  const contacts = supplier?.contacts || [];
  const retained = (products || []).filter((p) => p.status === 'RETENU').length;
  const place = [
    { label: 'Phase', value: booth.phase },
    { label: 'Hall', value: booth.hall },
    { label: 'Étage', value: booth.floor },
    { label: 'Lettre', value: booth.letter || '—', accent: true },
    { label: 'Numéro', value: boothNumber(booth) },
  ];

  const productColumns = [
    { title: 'Photo', dataIndex: 'cover_thumb', width: 64, render: (src) => <ProductThumb src={src} /> }, // D61
    {
      title: 'Désignation du produit', dataIndex: 'name',
      render: (v, p) => (
        <>
          {viewer ? <span className="fw-semibold">{v}</span> : <Link to={`/produits/${p.id}`} className="fw-semibold text-body">{v}</Link>}
          {p.description && <div className="small text-secondary text-truncate" style={{ maxWidth: 360 }}>{p.description}</div>}
        </>
      ),
    },
    { title: 'Réf. fournisseur', dataIndex: 'supplier_ref', render: (v) => v || '—' },
    {
      title: 'Prix', dataIndex: 'price', align: 'right',
      render: (v, p) => <strong className="text-nowrap">{formatPrice(v)}{v != null && p.unit ? ` / ${p.unit}` : ''}</strong>,
    },
    { title: 'Incoterm', dataIndex: 'shipping_type', align: 'center', render: (v) => (v ? <Tag className="m-0">{v}</Tag> : '—') },
    !viewer && {
      title: 'Décision', dataIndex: 'status', align: 'center',
      render: (v) => <Tag color={STATUS[v]?.color} className="m-0">{STATUS[v]?.label || v}</Tag>,
    },
    !viewer && {
      title: 'Actions', key: 'actions', align: 'right',
      render: (_, p) => (
        <Link to={`/produits/${p.id}`}><Button size="small" className="fw-semibold">Voir la fiche produit <ExportOutlined /></Button></Link>
      ),
    },
  ].filter(Boolean);

  return (
    <>
      <nav className="booth-crumb">
        <Link to="/booths"><ShopOutlined /> Booths</Link>
        <span className="mx-2 text-secondary">›</span>
        <strong>Booth {boothLabel(booth.phase, booth.booth_code)}</strong>
      </nav>

      <div className="page-header">
        <div className="d-flex align-items-center gap-3">
          <span className="booth-hall-badge" title={`Hall ${booth.hall}`}>{booth.hall}</span>
          <div>
            <h1 className="page-title">
              Booth {boothLabel(booth.phase, booth.booth_code)}
              {booth.visited ? <Tag color="green" className="m-0">Visité</Tag> : <Tag color="orange" className="m-0">À visiter</Tag>}
            </h1>
            <div className="page-subtitle text-uppercase small">
              Complexe de Pazhou{booth.zone && ` · Zone ${booth.zone}`} · Phase {booth.phase}{booth.sub_category && ` · ${booth.sub_category}`}
            </div>
          </div>
        </div>
        {viewer ? <Tag color="purple" className="m-0 align-self-center">Lecture seule</Tag> : (
        <div className="d-flex flex-wrap gap-2">
          {booth.visited
            ? <Button icon={<UndoOutlined />} onClick={() => setVisited(false)}>Remettre à visiter</Button>
            : <Button type="primary" icon={<CheckOutlined />} onClick={() => setVisited(true)}>Marquer visité</Button>}
          <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>Modifier</Button>
          <Popconfirm title="Supprimer ce booth ?" description={products?.length ? 'Ses produits sont gardés, sans booth.' : undefined}
            okText="Supprimer" okButtonProps={{ danger: true }} cancelText="Annuler" onConfirm={remove}>
            <Button type="primary" danger icon={<DeleteOutlined />}>Supprimer</Button>
          </Popconfirm>
        </div>
        )}
      </div>

      <Row gutter={[16, 16]} className="mb-3">
        <Col xs={24} xl={10}>
          <section className="sc-panel d-flex flex-column p-3">
            <div className="sc-panel-head mb-3 rounded">
              <EnvironmentOutlined className="sc-panel-icon fs-5" />
              <h2 className="flex-grow-1">Repérage du booth</h2>
              <span className="page-chip">{boothLabel(booth.phase, booth.booth_code)}</span>
            </div>
            <div className="booth-place mb-3">
              {place.map((c) => (
                <div key={c.label}>
                  <div className="sc-label">{c.label}</div>
                  <div className={`booth-place-value ${c.accent ? 'text-primary' : ''}`}>{c.value}</div>
                </div>
              ))}
            </div>
            <div className="sc-label mb-1">Catégorie</div>
            <p className="mb-3">{booth.sub_category ? [booth.category, booth.section, booth.sub_category !== booth.section && booth.sub_category].filter(Boolean).join(' › ') : '—'}</p>
            <div className="sc-label mb-1">Commentaire de visite</div>
            <div className="booth-comment flex-grow-1">{booth.comment ? `« ${booth.comment} »` : <span className="text-secondary">Aucun commentaire.</span>}</div>
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="sc-label">{booth.zone ? `Zone ${booth.zone} · halls ${ZONE_HALLS[booth.zone]}` : `Hall ${booth.hall}`}</span>
              <Link to="/plan-du-salon" className="fw-semibold">Plan du salon <ArrowRightOutlined /></Link>
            </div>
          </section>
        </Col>
        <Col xs={24} xl={14}>
          <section className="sc-panel d-flex flex-column p-3">
            {booth.supplier_id ? (
              <>
                <div className="sc-panel-head mb-3 rounded align-items-center">
                  <span className="kpi-icon"><BankOutlined /></span>
                  <div className="flex-grow-1">
                    <div className="sc-label">Fournisseur rattaché</div>
                    <h2>{booth.supplier_name}</h2>
                  </div>
                  {!viewer && (
                    <Link to={`/fournisseurs/${booth.supplier_id}`}>
                      <Button type="primary">Voir la fiche fournisseur <ArrowRightOutlined /></Button>
                    </Link>
                  )}
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="sc-label">Contacts du fournisseur</span>
                  <span className="small text-secondary">{plural(contacts.length, 'contact')}</span>
                </div>
                <div className="d-grid gap-2 flex-grow-1 align-content-start">
                  {contacts.length === 0 && <div className="booth-comment text-secondary">Aucun contact pour ce fournisseur.</div>}
                  {contacts.map((c) => (
                    <div key={c.id} className="booth-contact">
                      <ContactAvatar contact={c} size={48} />
                      <div className="flex-grow-1 overflow-hidden">
                        <div className="fw-semibold fs-6">{c.name || '—'}</div>
                        <div className="d-flex flex-wrap gap-3 small mt-1">
                          {c.phone && <a href={`tel:${c.phone}`} className="text-body"><PhoneOutlined /> {c.phone}</a>}
                          {c.email && <a href={`mailto:${c.email}`} className="text-body"><MailOutlined /> {c.email}</a>}
                        </div>
                      </div>
                      {c.wechat_qr && (
                        <div className="booth-contact-qr">
                          <QrThumb value={c.wechat_qr} size={64} />
                          <div className="sc-label mt-1">QR WeChat</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {!viewer && (
                  <div className="d-flex justify-content-end mt-3">
                    <Link to={`/contacts?supplier_id=${booth.supplier_id}`} className="fw-semibold">Gérer les contacts <ArrowRightOutlined /></Link>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-secondary my-auto py-4">
                <BankOutlined className="fs-3 mb-2" />
                <p className="mb-2">Ce booth n'a pas encore de fournisseur.</p>
                {!viewer && <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>Choisir le fournisseur</Button>}
              </div>
            )}
          </section>
        </Col>
      </Row>

      <section className="sc-panel p-3">
        <div className="d-flex flex-wrap align-items-start gap-3 mb-3">
          <InboxOutlined className="sc-panel-icon fs-4 mt-1" />
          <div className="flex-grow-1">
            <h2 className="h5 m-0">Produits de ce booth</h2>
            <div className="small text-secondary">Produits trouvés au booth {boothLabel(booth.phase, booth.booth_code)}</div>
          </div>
          {!viewer && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreatingProduct(true)}>Nouveau produit</Button>}
        </div>
        <Table rowKey="id" columns={productColumns} dataSource={products || []} loading={!products} size="middle"
          pagination={false} scroll={{ x: 'max-content' }} className="sc-table"
          locale={{ emptyText: 'Aucun produit enregistré à ce booth' }}
          footer={products?.length ? () => (
            <span className="text-secondary">
              Total : {plural(products.length, 'produit')} rattaché{products.length > 1 ? 's' : ''} au booth {boothLabel(booth.phase, booth.booth_code)}
              {!viewer && (
                <>
                  <span className="mx-2">·</span>
                  Retenus : {retained} ({Math.round((retained / products.length) * 100)} %)
                </>
              )}
            </span>
          ) : undefined} />
      </section>

      <FormModal open={editing} title={`Modifier le booth ${boothLabel(booth.phase, booth.booth_code)}`} width={640}
        initialValues={boothInitialValues(booth, categories)}
        onCancel={() => setEditing(false)}
        onSubmit={(values) => axios.put(`${API_BASE_URL}/booths/${id}`, boothPayload(values))}
        onSaved={() => { setEditing(false); message.success('Booth modifié'); load(); }}>
        <BoothFormFields />
      </FormModal>
      <NewProductModal open={creatingProduct} supplierId={booth.supplier_id || undefined}
        boothId={booth.supplier_id ? booth.id : undefined} onClose={() => setCreatingProduct(false)} />
    </>
  );
}
