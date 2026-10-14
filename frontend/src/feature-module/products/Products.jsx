import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { Input, Select, Space, Tabs } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { useAuth } from '../../context/AuthContext';
import { companyLabel, useList } from '../../utils/lists';
import ProductList from './ProductList';

// Every product of the group (BF10, BF12), and those shared with the user's company (BF14).
export default function Products() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('vue') === 'partages' ? 'mine' : 'all';
  const shippingTypes = useList('shipping-types');
  const [suppliers, setSuppliers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filters, setFilters] = useState({});

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
      <Select placeholder="Expédition" allowClear style={{ width: 130 }}
        options={shippingTypes.map((s) => ({ value: s.code, label: s.code }))} onChange={set('shipping_type')} />
      {!mine && (
        <Select placeholder="Partagé avec" allowClear showSearch optionFilterProp="label" style={{ width: 220 }}
          options={companies.map((c) => ({ value: c.id, label: companyLabel(c) }))} onChange={set('shared_with')} />
      )}
    </Space>
  );

  return (
    <>
      <h1 className="h4 mb-3">Produits</h1>
      <Tabs activeKey={tab} destroyOnHidden
        onChange={(k) => { setFilters({}); setParams(k === 'mine' ? { vue: 'partages' } : {}); }}
        items={[
          { key: 'all', label: 'Tous les produits', children: <>{filterBar(false)}<ProductList filters={filters} /></> },
          {
            key: 'mine',
            label: user.company_name
              ? `Partagés avec ${companyLabel({ name: user.company_name, branch: user.company_branch })}`
              : 'Partagés avec ma société',
            disabled: !user.company_id,
            children: <>{filterBar(true)}<ProductList filters={{ ...filters, mine: 1 }} /></>,
          },
        ]} />
    </>
  );
}
