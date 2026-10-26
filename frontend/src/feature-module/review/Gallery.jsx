import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { App, Button, Select } from 'antd';
import { ReloadOutlined, TagsOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { useStickyState } from '../../utils/place';
import CategorySelect from '../../components/CategorySelect';
import FormModal from '../../components/FormModal';
import PageHeader from '../../components/PageHeader';
import ProductGallery from './ProductGallery';

// D68: its own page, opened from the sidebar under Revue du soir. The revue itself is unchanged.
// D72: the photos can be limited by product category, by supplier, or by both.
// D73: the subtitle counts those products and suppliers. Ticked photos take one category,
// the same one on every product they belong to.
export default function Gallery() {
  const { message } = App.useApp();
  const [productCategories, setProductCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filters, setFilters] = useStickyState('filters:galerie', {});
  const [listed, setListed] = useState({ items: null, error: null });
  const [selected, setSelected] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const onItems = useCallback((state) => setListed(state), []);
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value ?? undefined }));

  useEffect(() => {
    axios.get(`${API_BASE_URL}/products/categories`).then((r) => setProductCategories(r.data.data)).catch(() => {});
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
  }, [reloadKey]);
  useEffect(() => { setSelected([]); }, [filters]);

  const items = listed.items || [];
  const productCount = new Set(items.map((item) => item.product_id)).size;
  const supplierCount = new Set(items.map((item) => item.supplier_id).filter((id) => id != null)).size;
  const counts = listed.items && !listed.error
    ? ` · ${productCount} produit${productCount > 1 ? 's' : ''} · ${supplierCount} fournisseur${supplierCount > 1 ? 's' : ''}`
    : '';
  const chosenProducts = [...new Set(items.filter((item) => selected.includes(item.id)).map((item) => item.product_id))];
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));
  const toggle = (id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const selectAll = () => setSelected(allSelected ? [] : items.map((item) => item.id));
  const assignCategories = (values) => axios.put(`${API_BASE_URL}/products/assign-categories`, {
    ids: chosenProducts,
    categories_products: values.categories_products || null,
  });

  return (
    <>
      <PageHeader title="Galerie" chip="Photos" subtitle={`Toutes les photos des produits${counts}`}
        actions={(
          <>
            <Button icon={<CheckSquareOutlined />} disabled={!items.length} onClick={selectAll}>
              {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </Button>
            <Button icon={<TagsOutlined />} disabled={!selected.length} onClick={() => setAssigning(true)}>
              Affecter catégorie{selected.length ? ` (${selected.length})` : ''}
            </Button>
          </>
        )} />
      <div className="sc-filters">
        <Select prefix={<span className="sc-label">Catégorie produit :</span>} placeholder="Toutes" allowClear mode="multiple"
          showSearch optionFilterProp="label" style={{ minWidth: 240 }} value={filters.categories_products}
          onChange={set('categories_products')}
          options={productCategories.map((c) => ({ value: c.name, label: c.name }))} />
        <Select prefix={<span className="sc-label">Fournisseur :</span>} placeholder="Tous" allowClear mode="multiple"
          showSearch optionFilterProp="label" style={{ minWidth: 260 }} value={filters.supplier_ids}
          onChange={set('supplier_ids')}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Button type="link" icon={<ReloadOutlined />} className="fw-semibold px-1"
          onClick={() => { setFilters({}); setSelected([]); }}>Réinitialiser</Button>
      </div>
      <ProductGallery categoriesProducts={filters.categories_products} supplierIds={filters.supplier_ids}
        reloadKey={reloadKey} onItems={onItems} selected={selected} onToggle={toggle} />
      <FormModal open={assigning} title="Affecter une catégorie" width={560}
        onCancel={() => setAssigning(false)}
        onSubmit={assignCategories}
        onSaved={() => {
          setAssigning(false);
          setSelected([]);
          setReloadKey((n) => n + 1);
          message.success(chosenProducts.length > 1 ? 'Catégorie affectée aux produits' : 'Catégorie affectée au produit');
        }}>
        <p className="text-secondary">Cette catégorie remplace celle des {chosenProducts.length} produit{chosenProducts.length > 1 ? 's' : ''} des photos cochées.</p>
        <CategorySelect name="categories_products" listPath="/products/categories" multiple={false} />
      </FormModal>
    </>
  );
}
