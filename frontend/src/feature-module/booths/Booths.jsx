import { useMemo, useState } from 'react';
import { Button, Cascader, Col, Grid, Input, Row, Select } from 'antd';
import { BuildOutlined, DownloadOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { ZONE_HALLS } from '../../utils/fairPlan';
import { categoryIdOf, categoryOptions, useList } from '../../utils/lists';
import BoothList, { boothNumber } from './BoothList';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import useDebounced from '../../utils/useDebounced';
import { isViewer } from '../../utils/access';
import { boothLabel } from '../../utils/format';

const ZONES = Object.entries(ZONE_HALLS).map(([zone, halls]) => ({ zone, halls }));
const HALLS = Array.from({ length: 21 }, (_, i) => i + 1);
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// The booths shown, as a CSV file for Excel (";" and a BOM, so accents and columns open right).
const exportCsv = (rows) => {
  const head = ['Code booth', 'Phase', 'Hall', 'Étage', 'Lettre', 'Numéro', 'Zone', 'Fournisseur', 'Catégorie', 'Produits', 'Statut', 'Commentaire'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((b) => [boothLabel(b.phase, b.booth_code), b.phase, b.hall, b.floor, b.letter, b.num_start == null ? '' : boothNumber(b), b.zone,
    b.supplier_name, b.sub_category, Number(b.nbr_products) || 0, b.visited ? 'Visité' : 'À visiter', b.comment].map(cell).join(';'));
  const blob = new Blob([`﻿${[head.map(cell).join(';'), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'booths.csv' });
  a.click();
  URL.revokeObjectURL(a.href);
};

// All booths of the group, or (planning) only those not visited yet (BF07, BF08); D49: laid out like
// the Stitch "Booths" screen (filter bar, counter, table, distribution by zone).
export default function Booths({ planning = false }) {
  const categories = useList('canton-categories');
  const screens = Grid.useBreakpoint();
  const checklist = planning && screens.md === false; // a phone's width
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim()); // D60: the search applies as you type
  const [rows, setRows] = useState([]);
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const viewer = isViewer(user); // D62: the booths shared with its company, read-only
  const options = useMemo(() => categoryOptions(categories, filters.phase), [categories, filters.phase]);
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value ?? undefined }));
  const reset = () => { setFilters({}); setSearch(''); };

  const visited = rows.filter((b) => b.visited).length;
  const zones = ZONES.map((z) => {
    const inZone = rows.filter((b) => b.zone === z.zone);
    return { ...z, total: inZone.length, visited: inZone.filter((b) => b.visited).length };
  });

  return (
    <>
      <PageHeader title={planning ? 'Booths à visiter' : 'Booths'} chip="Canton Fair Pazhou"
        subtitle={planning ? 'Les booths prévus, à marquer visités sur place' : 'Liste des booths et suivi terrain'}
        actions={(
          <>
            <Button icon={<DownloadOutlined />} disabled={!rows.length} onClick={() => exportCsv(rows)}>Exporter la liste</Button>
            {!viewer && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Nouveau booth</Button>}
          </>
        )} />

      <div className="sc-filters">
        <Input prefix={<SearchOutlined />} placeholder="Rechercher code booth, fournisseur…" allowClear style={{ width: 280 }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select prefix={<span className="sc-label">Phase :</span>} placeholder="Toutes" allowClear style={{ width: 170 }}
          value={filters.phase} options={[1, 2, 3].map((n) => ({ value: n, label: `Phase ${n}` }))}
          onChange={(phase) => setFilters((f) => ({ ...f, phase: phase ?? undefined, category_path: undefined, category_id: undefined }))} />
        <Select prefix={<span className="sc-label">Hall :</span>} placeholder="Tous les halls" allowClear showSearch style={{ width: 190 }}
          value={filters.hall} onChange={set('hall')} options={HALLS.map((h) => ({ value: h, label: `Hall ${h}` }))} />
        {!planning && (
          <Select prefix={<span className="sc-label">Statut :</span>} placeholder="Tous" allowClear style={{ width: 170 }}
            value={filters.visited} onChange={set('visited')}
            options={[{ value: 0, label: 'À visiter' }, { value: 1, label: 'Visités' }]} />
        )}
        <Cascader placeholder="Catégorie" allowClear showSearch style={{ width: 240 }} options={options}
          value={filters.category_path} onChange={(path) => setFilters((f) => ({ ...f, category_path: path, category_id: categoryIdOf(path) ?? undefined }))} />
        <Button type="link" icon={<ReloadOutlined />} className="fw-semibold px-1" onClick={reset}>Réinitialiser</Button>
        <span className="sc-counter ms-lg-auto">
          <span className="share-dot rounded-circle" style={{ background: 'var(--sc-accent)' }} />
          <strong>{plural(rows.length - visited, 'booth')} à visiter</strong>
          {(!planning || checklist) && <> · {plural(visited, 'visité')} <span className="sc-label">({rows.length} au total)</span></>}
        </span>
      </div>

      {/* D52: on a phone, "À visiter" is a checklist that keeps the visited booths (to undo a tap). */}
      <BoothList filters={{ ...filters, q: q || undefined, category_path: undefined, visited: checklist ? undefined : planning ? 0 : filters.visited }}
        planning={planning} checklist={checklist}
        createOpen={creating} onCreateOpenChange={setCreating} onLoaded={setRows} />

      <Row gutter={[16, 16]} className="mt-3">
        <Col xs={24} lg={12} xxl={8}>
          <section className="sc-panel">
            <div className="sc-panel-head">
              <div className="flex-grow-1"><h2>Répartition par zone</h2></div>
              <BuildOutlined className="sc-panel-icon fs-5" />
            </div>
            <div className="p-3 d-grid gap-3">
              {zones.map((z) => (
                <div key={z.zone}>
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="fw-semibold text-primary">Zone {z.zone} (halls {z.halls})</span>
                    <span className="fw-semibold">{plural(z.total, 'booth')}{z.total > 0 && !planning ? ` · ${z.visited} visité${z.visited > 1 ? 's' : ''}` : ''}</span>
                  </div>
                  <div className="sc-progress">
                    <span style={{ width: `${rows.length ? (z.total / rows.length) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
              <div className="small text-secondary">Booths de la liste ci-dessus, selon les filtres.</div>
            </div>
          </section>
        </Col>
      </Row>
    </>
  );
}
