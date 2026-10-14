import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { Input, Select, Space, Tabs, TreeSelect } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { categoryTree } from '../../utils/format';
import ProductList from './ProductList';

// Our products (BF10, BF12) and the products other companies share with us (BF14).
export default function Products() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('vue') === 'partages' ? 'shared' : 'own';
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
    axios.get(`${API_BASE_URL}/categories`).then((r) => setCategories(r.data.data)).catch(() => {});
  }, []);
  const tree = useMemo(() => categoryTree(categories), [categories]);
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value || undefined }));

  const filterBar = (shared) => (
    <Space className="mb-3" wrap>
      <Input.Search placeholder="Nom, référence, description" allowClear style={{ width: 260 }} onSearch={set('q')} />
      {!shared && (
        <Select placeholder="Fournisseur" allowClear showSearch optionFilterProp="label" style={{ width: 220 }}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))} onChange={set('supplier_id')} />
      )}
      <TreeSelect placeholder="Catégorie" allowClear style={{ width: 220 }} treeData={tree}
        showSearch treeNodeFilterProp="title" onChange={set('category_id')} />
    </Space>
  );

  return (
    <>
      <h1 className="h4 mb-3">Produits</h1>
      <Tabs activeKey={tab} destroyOnHidden
        onChange={(k) => { setFilters({}); setParams(k === 'shared' ? { vue: 'partages' } : {}); }}
        items={[
          { key: 'own', label: 'Nos produits', children: <>{filterBar(false)}<ProductList filters={filters} /></> },
          { key: 'shared', label: 'Partagés avec nous', children: <>{filterBar(true)}<ProductList filters={filters} shared /></> },
        ]} />
    </>
  );
}
