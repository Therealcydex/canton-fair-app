import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { Button, Input, Select, Space, Tabs } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { useAuth } from '../../context/AuthContext';
import { companyLabel, useList } from '../../utils/lists';
import { STATUS } from '../../utils/decision';
import ProductList, { NewProductModal } from './ProductList';

// Every product of the group (BF10, BF12), and those shared with the user's company (BF14).
export default function Products() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('vue') === 'partages' ? 'mine' : 'all';
  const shippingTypes = useList('shipping-types');
  const [suppliers, setSuppliers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filters, setFilters] = useState({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
    axios.get(`${API_BASE_URL}/companies`).then((r) => setCompanies(r.data.data)).catch(() => {});
  }, []);
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value || undefined }));

  const filterBar = (mine) => (
    <Space className="mb-3" wrap>
      <Input.Search placeholder="Nom, référence, description" allowClear style={{ width: 260 }} onSearch={set('q')} />
      <Select placeholder="Fournisseur" allowClear showSearch optionFilterProp="label" style={{ width: 220 }}
        options={suppliers.map((s) => ({ value: s.id, label: s.name }))} onChange={set('supplier_id')} />
      <Select placeholder="Décision" allowClear style={{ width: 150 }}
        options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} onChange={set('status')} />
      <Select placeholder="Expédition" allowClear style={{ width: 130 }}
        options={shippingTypes.map((s) => ({ value: s.code, label: s.code }))} onChange={set('shipping_type')} />
      {!mine && (
        <>
          <Select placeholder="Partage" allowClear style={{ width: 150 }} onChange={set('shared')}
            options={[{ value: '1', label: 'Partagés' }, { value: '0', label: 'Non partagés' }]} />
          <Select placeholder="Partagé avec" allowClear showSearch optionFilterProp="label" style={{ width: 220 }}
            options={companies.map((c) => ({ value: c.id, label: companyLabel(c) }))} onChange={set('shared_with')} />
        </>
      )}
    </Space>
  );

  // D40: design from Claude Design ("Produits", version A): select products, then "Partager avec…".
  return (
    <>
      <Space className="mb-3 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">Produits</h1>
        <Button type="primary" onClick={() => setCreating(true)}>Nouveau produit</Button>
      </Space>
      <Tabs activeKey={tab} destroyOnHidden
        onChange={(k) => { setFilters({}); setParams(k === 'mine' ? { vue: 'partages' } : {}); }}
        items={[
          { key: 'all', label: 'Tous les produits', children: <>{filterBar(false)}<ProductList filters={filters} companies={companies} /></> },
          {
            key: 'mine',
            label: user.company_name
              ? `Partagés avec ${companyLabel({ name: user.company_name, branch: user.company_branch })}`
              : 'Partagés avec ma société',
            disabled: !user.company_id,
            children: <>{filterBar(true)}<ProductList filters={{ ...filters, mine: 1 }} companies={companies} /></>,
          },
        ]} />
      <NewProductModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
