import { PictureOutlined } from '@ant-design/icons';

// D61: a product's thumbnail in the lists, or a placeholder of the same size when it has no
// photo, so every row keeps its picture column (also at a phone's width, and while filtering).
export default function ProductThumb({ src, size = 48, className = '' }) {
  if (src) {
    return <img src={src} alt="" width={size} height={size} className={`product-thumb ${className}`} loading="lazy" />;
  }
  return (
    <span className={`product-thumb product-thumb-empty ${className}`} style={{ width: size, height: size }}
      title="Pas de photo" aria-label="Pas de photo">
      <PictureOutlined />
    </span>
  );
}
