import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { App, Button, Input, Select } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined, TagsOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { useList } from '../../utils/lists';
import { STATUS } from '../../utils/decision';
import useDebounced from '../../utils/useDebounced';
import { useStickyState } from '../../utils/place';
import ProductList, { NewProductModal } from './ProductList';
import CategorySelect from '../../components/CategorySelect';
import FormModal from '../../components/FormModal';
import PageHeader from '../../components/PageHeader';

// Every product of the group (BF10, BF12). D60: the filters are controlled, so "Réinitialiser"
// and each clear (×) empty them on screen and in the list at once; the search applies as you type.
// D62: products are no longer shared (booths are).
export default function Products() {
  const { message } = App.useApp();
  const shippingTypes = useList('shipping-types');
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useStickyState('filters:products', {});
  const [search, setSearch] = useStickyState('search:products', '');
  const q = useDebounced(search.trim());
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [listed, setListed] = useState({ rows: [], loading: true, loadError: null });
  const [selected, setSelected] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const onRows = useCallback((state) => setListed(state), []);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
  }, []);
  const loadCategories = () => {
    axios.get(`${API_BASE_URL}/products/categories`).then((r) => setCategories(r.data.data)).catch(() => {});
  };
  useEffect(() => { loadCategories(); }, [reloadKey]);
  const supplierCount = new Set(listed.rows.map((r) => r.supplier_id).filter((id) => id != null)).size;
  const counts = !listed.loading && !listed.loadError
    ? ` · ${listed.rows.length} produit${listed.rows.length > 1 ? 's' : ''} · ${supplierCount} fournisseur${supplierCount > 1 ? 's' : ''}`
    : '';
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value ?? undefined }));
  const reset = () => { setFilters({}); setSearch(''); setSelected([]); };
  useEffect(() => { setSelected([]); }, [q, filters]);

  const assignCategories = (values) => axios.put(`${API_BASE_URL}/products/assign-categories`, {
    ids: selected,
    categories_products: values.categories_products || null,
  });

  return (
    <>
      <PageHeader title="Produits" chip="Catalogue" subtitle={`Catalogue de sourcing du groupe${counts}`}
        actions={(
          <>
            <Button icon={<TagsOutlined />} disabled={!selected.length} onClick={() => setAssigning(true)}>
              Affecter catégorie{selected.length ? ` (${selected.length})` : ''}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Nouveau produit</Button>
          </>
        )} />
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
        <Select prefix={<span className="sc-label">Catégories :</span>} placeholder="Toutes" allowClear mode="multiple"
          showSearch optionFilterProp="label" style={{ minWidth: 220 }} value={filters.categories_products}
          onChange={set('categories_products')} onOpenChange={(open) => { if (open) loadCategories(); }}
          options={categories.map((c) => ({ value: c.name, label: c.name }))} />
        <Button type="link" icon={<ReloadOutlined />} className="fw-semibold px-1" onClick={reset}>Réinitialiser</Button>
      </div>
      <ProductList filters={{
        ...filters,
        q: q || undefined,
        categories_products: filters.categories_products?.length ? filters.categories_products.join(',') : undefined,
      }} reloadKey={reloadKey} onRows={onRows} selectedRowKeys={selected} onSelectedChange={setSelected} />
      <NewProductModal open={creating} onClose={() => setCreating(false)} onCreated={() => setReloadKey((n) => n + 1)} />
      <FormModal open={assigning} title="Affecter une catégorie" width={560}
        onCancel={() => setAssigning(false)}
        onSubmit={assignCategories}
        onSaved={() => {
          setAssigning(false);
          setSelected([]);
          setReloadKey((n) => n + 1);
          message.success(selected.length > 1 ? 'Catégorie affectée aux produits' : 'Catégorie affectée au produit');
        }}>
        <p className="text-secondary">Cette catégorie remplace celle des {selected.length} produit{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}.</p>
        <CategorySelect name="categories_products" listPath="/products/categories" multiple={false} />
      </FormModal>
    </>
  );
}
