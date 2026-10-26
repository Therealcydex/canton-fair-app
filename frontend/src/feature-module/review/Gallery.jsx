import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button, Select } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { useStickyState } from '../../utils/place';
import PageHeader from '../../components/PageHeader';
import ProductGallery from './ProductGallery';

// D68: its own page, opened from the sidebar under Revue du soir. The revue itself is unchanged.
// D72: the photos can be limited by product category, by supplier, or by both.
export default function Gallery() {
  const [productCategories, setProductCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filters, setFilters] = useStickyState('filters:galerie', {});
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value ?? undefined }));

  useEffect(() => {
    axios.get(`${API_BASE_URL}/products/categories`).then((r) => setProductCategories(r.data.data)).catch(() => {});
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
  }, []);

  return (
    <>
      <PageHeader title="Galerie" chip="Photos" subtitle="Toutes les photos des produits" />
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
          onClick={() => setFilters({})}>Réinitialiser</Button>
      </div>
      <ProductGallery categoriesProducts={filters.categories_products} supplierIds={filters.supplier_ids} />
    </>
  );
}
