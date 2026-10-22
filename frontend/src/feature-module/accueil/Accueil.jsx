import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Alert, Col, Row, Space, Spin, Table, Tag } from 'antd';
import {
  ApartmentOutlined, ArrowRightOutlined, BankOutlined, EnvironmentOutlined, InboxOutlined,
  RiseOutlined, ScheduleOutlined, ShareAltOutlined, ShopOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { API_BASE_URL } from '../../config/config';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../theme';
import { isAdmin } from '../../utils/access';
import { apiError } from '../../utils/apiError';
import { companyLabel } from '../../utils/lists';

// D40: the group's progress at the fair; D49: laid out like the Stitch "Accueil - Tableau de bord" screen.
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const pctColor = (p) => (p >= 75 ? 'green' : p > 0 ? 'blue' : 'default');
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
// Colours of the companies in the shares bar, in the Stitch order.
const SHARE_COLORS = ['#002a81', '#b9cdf5', '#a7b0f0', '#f7a05b', '#4d6077', '#72c2a8'];

// "Oct.23 - 27" or "Oct.31 - Nov.4" (the fair's own notation) -> [first day, last day] this year.
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const phaseDays = (dates, year) => {
  const m = /^(\w{3})\.?\s*(\d+)\s*-\s*(?:(\w{3})\.?\s*)?(\d+)$/.exec((dates || '').trim());
  if (!m || MONTHS[m[1]] === undefined) return null;
  const end = m[3] ? MONTHS[m[3]] : MONTHS[m[1]];
  if (end === undefined) return null;
  return [new Date(year, MONTHS[m[1]], Number(m[2])), new Date(year, end, Number(m[4]), 23, 59)];
};

export default function Accueil() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/dashboard`)
      .then((r) => setData(r.data.data))
      .catch((err) => setLoadError(apiError(err, 'Erreur lors du chargement du tableau de bord')));
  }, []);

  const header = (current) => (
    <PageHeader eyebrow="Tableau de bord / Vue générale" title="Accueil"
      actions={(
        <Space wrap>
          <Tag icon={<EnvironmentOutlined />} className="m-0 py-1 px-2">Foire de Canton</Tag>
          {current && <Tag color="green" className="m-0 py-1 px-2">Phase {current.phase} en cours ({current.dates})</Tag>}
        </Space>
      )} />
  );

  if (loadError) return <>{header()}<Alert type="error" message={loadError} showIcon /></>;
  if (!data) return <>{header()}<div className="text-center py-5"><Spin /></div></>;

  const now = new Date();
  const current = data.phases.find((p) => {
    const days = phaseDays(p.dates, now.getFullYear());
    return days && now >= days[0] && now <= days[1];
  });
  const planned = data.phases.reduce((s, p) => s + p.planned, 0);
  const visited = data.phases.reduce((s, p) => s + p.visited, 0);
  const companies = data.companies.map((c, i) => ({ ...c, color: SHARE_COLORS[i % SHARE_COLORS.length] }));
  const sharing = companies.filter((c) => c.shared > 0);
  const totalShared = sharing.reduce((s, c) => s + c.shared, 0);

  const kpis = [
    {
      label: 'Fournisseurs', value: data.suppliers, icon: <BankOutlined />,
      foot: [<span key="a">Fournisseurs du groupe</span>, <Link key="b" to="/fournisseurs">Voir les fournisseurs →</Link>],
    },
    {
      label: 'Booths visités', value: <>{visited}<small> / {planned}</small></>, icon: <ShopOutlined />,
      extra: (
        <div className="mt-3">
          <div className="d-flex justify-content-between gap-2 small mb-1">
            <span>Progression globale</span>
            <span>{planned ? `${pct(visited, planned)} % des booths prévus` : 'Aucun booth prévu'}</span>
          </div>
          <div className="sc-progress"><span style={{ width: `${pct(visited, planned)}%` }} /></div>
        </div>
      ),
      foot: [<span key="a">{plural(planned - visited, 'booth')} à visiter</span>, <Link key="b" to="/a-visiter">À visiter →</Link>],
    },
    {
      label: 'Produits enregistrés', value: data.products, icon: <InboxOutlined />,
      extra: <Tag color="green" icon={<RiseOutlined />} className="mt-2">+{data.products_week} ces 7 derniers jours</Tag>,
      foot: [<span key="a">Catalogue du groupe</span>, <Link key="b" to="/produits">Produits →</Link>],
    },
    {
      label: 'Partages', value: data.shares, icon: <ShareAltOutlined />,
      extra: (
        <div className="small mt-2">
          <strong>{plural(data.suppliers_shared, 'fournisseur')}</strong> vers{' '}
          <strong>{plural(data.companies.length, 'société')}</strong> du groupe
        </div>
      ),
    },
  ];

  return (
    <>
      {header(current)}
      <Row gutter={[16, 16]} className="mb-3">
        {kpis.map((k) => (
          <Col key={k.label} xs={24} sm={12} xl={6}>
            <div className="kpi-tile">
              <div className="kpi-tile-body">
                <div className="flex-grow-1">
                  <div className="sc-label">{k.label}</div>
                  <div className="kpi-value">{k.value}</div>
                  {k.extra}
                </div>
                <span className="kpi-icon fs-5">{k.icon}</span>
              </div>
              {k.foot && <div className="kpi-foot">{k.foot}</div>}
            </div>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <section className="sc-panel">
            <div className="sc-panel-head">
              <ScheduleOutlined className="sc-panel-icon fs-5" />
              <div className="flex-grow-1">
                <h2>Booths par phase</h2>
                <div className="small text-secondary">Booths prévus et visités, phase par phase</div>
              </div>
            </div>
            <Table rowKey="phase" size="middle" pagination={false} dataSource={data.phases} scroll={{ x: true }}
              onRow={(r) => (r === current ? { style: { background: '#f2f5fc' } } : {})}
              columns={[
                {
                  title: 'Phase', dataIndex: 'phase',
                  render: (v, r) => (
                    <>
                      <div className={r === current ? 'text-primary fw-semibold' : 'fw-medium'}>Phase {v}</div>
                      {r.dates && <div className="small text-secondary">{r.dates}{r === current && ' · en cours'}</div>}
                    </>
                  ),
                },
                { title: 'Prévus', dataIndex: 'planned', align: 'right' },
                { title: 'Visités', dataIndex: 'visited', align: 'right', render: (v) => <strong>{v}</strong> },
                { title: 'Restants', align: 'right', render: (_, r) => r.planned - r.visited },
                {
                  title: 'Avancement', align: 'center',
                  render: (_, r) => {
                    if (!r.planned) return <Tag className="m-0">Aucun booth</Tag>;
                    const p = pct(r.visited, r.planned);
                    return <Tag color={pctColor(p)} className="m-0">{r.visited ? `${p} %` : 'À venir'}</Tag>;
                  },
                },
              ]}
              summary={() => (
                <Table.Summary.Row style={{ background: 'var(--sc-panel)' }}>
                  <Table.Summary.Cell index={0}><span className="h6 m-0">TOTAL</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">{planned}</Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right"><strong>{visited}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">{planned - visited}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="center">
                    <Tag color={COLORS.primary} className="m-0">{pct(visited, planned)} % GLOBAL</Tag>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )} />
            <div className="sc-panel-foot">
              <span>Zones A, B, C et D du complexe de Pazhou</span>
              <Link to="/a-visiter">Booths à visiter <ArrowRightOutlined /></Link>
            </div>
          </section>
        </Col>
        <Col xs={24} xl={12}>
          <section className="sc-panel">
            <div className="sc-panel-head">
              <ApartmentOutlined className="sc-panel-icon fs-5" />
              <div className="flex-grow-1">
                <h2>Fournisseurs partagés par société</h2>
                <div className="small text-secondary">Fournisseurs partagés avec les sociétés du groupe, en lecture seule</div>
              </div>
              <Tag className="m-0">{plural(data.companies.length, 'société')}</Tag>
            </div>
            {totalShared > 0 && (
              <div className="px-3 pt-3 pb-3">
                <div className="d-flex justify-content-between mb-2">
                  <span className="sc-label">Répartition des partages</span>
                  <span className="small fw-semibold text-primary">{plural(totalShared, 'partage')}</span>
                </div>
                <div className="share-bar mb-2">
                  {sharing.map((c) => (
                    <span key={c.id} title={`${companyLabel(c)} : ${c.shared}`}
                      style={{ width: `${(c.shared / totalShared) * 100}%`, background: c.color }} />
                  ))}
                </div>
                <div className="share-legend">
                  {sharing.map((c) => (
                    <span key={c.id}>
                      <span className="share-dot" style={{ background: c.color }} />
                      {companyLabel(c)} ({pct(c.shared, totalShared)} %)
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Table rowKey="id" size="middle" pagination={false} dataSource={companies} scroll={{ x: true }}
              locale={{ emptyText: 'Aucune société' }}
              columns={[
                {
                  title: 'Société',
                  render: (_, c) => (
                    <span className="fw-medium"><span className="share-dot" style={{ background: c.color }} />{companyLabel(c)}</span>
                  ),
                },
                { title: 'Partagés', dataIndex: 'shared', align: 'right', render: (v) => <strong>{v}</strong> },
                {
                  title: '% des fournisseurs', align: 'right',
                  render: (_, c) => <span className="fw-semibold text-primary">{pct(c.shared, data.suppliers)} %</span>,
                },
              ]} />
            {isAdmin(user) && (
              <div className="sc-panel-foot">
                <span>Sociétés du groupe</span>
                <Link to="/admin/societes">Gérer les sociétés <ArrowRightOutlined /></Link>
              </div>
            )}
          </section>
        </Col>
      </Row>
    </>
  );
}
