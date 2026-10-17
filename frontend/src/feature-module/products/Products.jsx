import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button, Input, Select } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { useList } from '../../utils/lists';
import { STATUS } from '../../utils/decision';
import useDebounced from '../../utils/useDebounced';
import ProductList, { NewProductModal } from './ProductList';
import PageHeader from '../../components/PageHeader';

// Every product of the group (BF10, BF12). D60: the filters are controlled, so "Réinitialiser"
// and each clear (×) empty them on screen and in the list at once; the search applies as you type.
// D62: products are no longer shared (booths are).
export default function Products() {
  const shippingTypes = useList('shipping-types');
  const [suppliers, setSuppliers] = useState([]);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
  }, []);
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value ?? undefined }));
  const reset = () => { setFilters({}); setSearch(''); };

  return (
    <>
      <PageHeader title="Produits" chip="Catalogue" subtitle="Catalogue de sourcing du groupe"
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Nouveau produit</Button>} />
      <div className="sc-filters">
        <Input prefix={<SearchOutlined />} placeholder="Nom, référence, description" allowClear style={{ width: 280 }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select prefix={<span className="sc-label">Fournisseur :</span>} placeholder="Tous" allowClear showSearch optionFilterProp="label"
          style={{ width: 260 }} value={filters.supplier_id} onChange={set('supplier_id')}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Select prefix={<span className="sc-label">Décision :</span>} placeholder="Toutes" allowClear style={{ width: 210 }}
          value={filters.status} onChange={set('status')}
          options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} />
        <Select prefix={<span className="sc-label">Expédition :</span>} placeholder="Toutes" allowClear style={{ width: 180 }}
          value={filters.shipping_type} onChange={set('shipping_type')}
          options={shippingTypes.map((s) => ({ value: s.code, label: s.code }))} />
        <Button type="link" icon={<ReloadOutlined />} className="fw-semibold px-1" onClick={reset}>Réinitialiser</Button>
      </div>
      <ProductList filters={{ ...filters, q: q || undefined }} />
      <NewProductModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
