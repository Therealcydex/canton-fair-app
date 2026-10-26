import PageHeader from '../../components/PageHeader';
import ProductGallery from './ProductGallery';

// D68: its own page, opened from the sidebar under Revue du soir. The revue itself is unchanged.
export default function Gallery() {
  return (
    <>
      <PageHeader title="Galerie" chip="Photos" subtitle="Toutes les photos des produits" />
      <ProductGallery />
    </>
  );
}
