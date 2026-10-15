import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Alert, Card, Col, Row, Space, Spin, Table, Tag } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { companyLabel } from '../../utils/lists';

// D40: the group's progress at the fair (design: Claude Design "Accueil", version A).
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const pctColor = (p) => (p >= 75 ? 'green' : p > 0 ? 'blue' : 'default');
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

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
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/dashboard`)
      .then((r) => setData(r.data.data))
      .catch((err) => setLoadError(apiError(err, 'Erreur lors du chargement du tableau de bord')));
  }, []);

  const header = (current) => (
    <Space className="mb-3 w-100 justify-content-between" wrap>
      <h1 className="h4 m-0">Accueil</h1>
      <span className="text-muted small">
        Foire de Canton{current && <Tag color="green" className="ms-2">Phase {current.phase} en cours</Tag>}
      </span>
    </Space>
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
  const kpis = [
    { label: 'Fournisseurs', value: data.suppliers, sub: <Link to="/fournisseurs">Voir les fournisseurs</Link> },
    {
      label: 'Stands visités',
      value: <>{visited}<span className="text-muted fs-6"> / {planned}</span></>,
      sub: planned ? `${pct(visited, planned)} % des stands prévus` : 'Aucun stand prévu',
    },
    { label: 'Produits enregistrés', value: data.products, sub: `+${data.products_week} ces 7 derniers jours` },
    {
      label: 'Partages',
      value: data.shares,
      sub: `${plural(data.products_shared, 'produit')} vers ${plural(data.companies.length, 'société')} du groupe`,
    },
  ];

  return (
    <>
      {header(current)}
      <Row gutter={[16, 16]} className="mb-3">
        {kpis.map((k) => (
          <Col key={k.label} xs={24} sm={12} xl={6}>
            <Card size="small">
              <div className="text-muted small mb-1">{k.label}</div>
              <div className="fs-3 fw-semibold lh-sm">{k.value}</div>
              <div className="text-muted small mt-1">{k.sub}</div>
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="Stands par phase" size="small">
            <Table rowKey="phase" size="middle" pagination={false} dataSource={data.phases} scroll={{ x: true }}
              columns={[
                {
                  title: 'Phase', dataIndex: 'phase',
                  render: (v, r) => (
                    <span className="fw-medium">
                      Phase {v}{r.dates && <span className="text-muted small fw-normal"> · {r.dates}</span>}
                    </span>
                  ),
                },
                { title: 'Prévus', dataIndex: 'planned', align: 'right' },
                { title: 'Visités', dataIndex: 'visited', align: 'right' },
                { title: 'Restants', align: 'right', render: (_, r) => r.planned - r.visited },
                {
                  title: 'Avancement', align: 'right',
                  render: (_, r) => {
                    if (!r.planned) return <Tag className="m-0">Aucun stand</Tag>;
                    const p = pct(r.visited, r.planned);
                    return <Tag color={pctColor(p)} className="m-0">{r.visited ? `${p} %` : 'À venir'}</Tag>;
                  },
                },
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}><span className="fw-medium">Total</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">{planned}</Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">{visited}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">{planned - visited}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Tag color={pctColor(pct(visited, planned))} className="m-0">{pct(visited, planned)} %</Tag>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )} />
            <div className="mt-2 small"><Link to="/a-visiter">Stands à visiter →</Link></div>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Produits partagés par société" size="small">
            <Table rowKey="id" size="middle" pagination={false} dataSource={data.companies} scroll={{ x: true }}
              locale={{ emptyText: 'Aucune société' }}
              columns={[
                { title: 'Société', render: (_, c) => <span className="fw-medium">{companyLabel(c)}</span> },
                { title: 'Partagés', dataIndex: 'shared', align: 'right' },
                { title: '% des produits', align: 'right', render: (_, c) => `${pct(c.shared, data.products)} %` },
              ]} />
          </Card>
        </Col>
      </Row>
    </>
  );
}
