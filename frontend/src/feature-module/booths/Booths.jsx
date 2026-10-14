import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Input, InputNumber, Space, TreeSelect } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { categoryTree } from '../../utils/format';
import BoothList from './BoothList';

// All booths of the company, or (planning) only those still to visit (BF07, BF08).
export default function Booths({ planning = false }) {
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    axios.get(`${API_BASE_URL}/categories`).then((r) => setCategories(r.data.data)).catch(() => {});
  }, []);
  const tree = useMemo(() => categoryTree(categories), [categories]);
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value ?? undefined }));

  return (
    <>
      <h1 className="h4 mb-3">{planning ? 'Stands à visiter' : 'Stands'}</h1>
      <Space className="mb-3" wrap>
        <Input.Search placeholder="Fournisseur" allowClear style={{ width: 220 }} onSearch={(q) => set('q')(q || undefined)} />
        <InputNumber placeholder="Phase" min={1} max={9} style={{ width: 100 }} onChange={set('phase')} />
        <InputNumber placeholder="Hall" min={1} max={127} style={{ width: 100 }} onChange={set('hall')} />
        <TreeSelect placeholder="Catégorie" allowClear style={{ width: 220 }} treeData={tree}
          showSearch treeNodeFilterProp="title" onChange={set('category_id')} />
      </Space>
      <BoothList filters={{ ...filters, to_visit: planning ? 1 : undefined }} planning={planning} />
    </>
  );
}
