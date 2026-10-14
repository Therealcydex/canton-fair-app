import { useMemo, useState } from 'react';
import { Cascader, Input, InputNumber, Select, Space } from 'antd';
import { categoryOptions, useList } from '../../utils/lists';
import BoothList from './BoothList';

// All booths of the group, or (planning) only those not visited yet (BF07, BF08).
export default function Booths({ planning = false }) {
  const categories = useList('canton-categories');
  const [filters, setFilters] = useState({});
  const options = useMemo(() => categoryOptions(categories, filters.phase), [categories, filters.phase]);
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value ?? undefined }));

  return (
    <>
      <h1 className="h4 mb-3">{planning ? 'Stands à visiter' : 'Stands'}</h1>
      <Space className="mb-3" wrap>
        <Input.Search placeholder="Code ou fournisseur" allowClear style={{ width: 220 }} onSearch={(q) => set('q')(q || undefined)} />
        <Select placeholder="Phase" allowClear style={{ width: 110 }} onChange={set('phase')}
          options={[1, 2, 3].map((n) => ({ value: n, label: `Phase ${n}` }))} />
        <InputNumber placeholder="Hall" min={1} max={127} style={{ width: 100 }} onChange={set('hall')} />
        <Cascader placeholder="Catégorie" allowClear showSearch style={{ width: 260 }} options={options}
          onChange={(path) => set('category_id')(path?.[2])} />
        {!planning && (
          <Select placeholder="Visite" allowClear style={{ width: 130 }} onChange={set('visited')}
            options={[{ value: 0, label: 'À visiter' }, { value: 1, label: 'Visités' }]} />
        )}
      </Space>
      <BoothList filters={{ ...filters, visited: planning ? 0 : filters.visited }} planning={planning} />
    </>
  );
}
