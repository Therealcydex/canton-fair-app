import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Button, Checkbox, Empty, Spin } from 'antd';
import { CloseOutlined, DownloadOutlined, LeftOutlined, PictureOutlined, RightOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';

const productIds = (items) => {
  const ids = [];
  const seen = new Set();
  items.forEach((item) => {
    if (!seen.has(item.product_id)) {
      seen.add(item.product_id);
      ids.push(item.product_id);
    }
  });
  return ids;
};

// D68: "Galerie" under Revue du soir. Every product photo, full screen on a phone and a computer.
// Swipe (or drag) moves to the next photo, like the phone's gallery. A click or a long press
// opens that product; Retour on the fiche comes back to this same photo.
export default function ProductGallery({ categoriesProducts, supplierIds, reloadKey = 0, onItems, selected = [], onToggle }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState(null); // index in `items`, or null for the grid
  const [full, setFull] = useState(null); // the large photo of the open slide
  const [downloading, setDownloading] = useState(false);
  const cache = useRef({});
  const drag = useRef(null);
  const hold = useRef(null);
  const held = useRef(false);
  const query = JSON.stringify({
    categories_products: categoriesProducts?.length ? categoriesProducts.join(',') : undefined,
    supplier_ids: supplierIds?.length ? supplierIds.join(',') : undefined,
  });
  const filtered = Boolean(categoriesProducts?.length || supplierIds?.length);

  useEffect(() => {
    let live = true;
    setItems(null);
    setError(null);
    setView(null);
    axios.get(`${API_BASE_URL}/products/gallery`, { params: JSON.parse(query) })
      .then((r) => { if (live) setItems(r.data.data); })
      .catch((err) => { if (live) setError(apiError(err, 'Erreur lors du chargement de la galerie')); });
    return () => { live = false; };
  }, [query, reloadKey]);

  useEffect(() => {
    onItems?.({ items, error });
  }, [items, error, onItems]);

  // Coming back from a fiche reopens the same photo.
  useEffect(() => {
    if (!items || sessionStorage.getItem('galerie-open') !== '1') return;
    const index = Number(sessionStorage.getItem('galerie-index') || 0);
    setView(Math.min(Math.max(0, index), Math.max(0, items.length - 1)));
    sessionStorage.removeItem('galerie-open');
  }, [items]);

  const openProduct = useCallback((index) => {
    const item = items?.[index];
    if (!item) return;
    sessionStorage.setItem('galerie-open', '1');
    sessionStorage.setItem('galerie-index', String(index));
    sessionStorage.setItem('galerie-products', JSON.stringify(productIds(items)));
    navigate(`/produits/${item.product_id}?from=galerie`);
  }, [items, navigate]);

  // The full photo, not the thumbnail. Saved under the product name.
  const download = useCallback(async () => {
    const item = items?.[view];
    if (!item) return;
    setDownloading(true);
    try {
      let images = cache.current[item.product_id];
      if (!images) {
        const { data } = await axios.get(`${API_BASE_URL}/products/${item.product_id}`);
        images = data.data.images || [];
        cache.current[item.product_id] = images;
      }
      const src = images.find((img) => img.id === item.id)?.image_data || full;
      if (!src) return;
      const blob = await (await fetch(src)).blob();
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
      const name = `${(item.name || 'photo').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'photo'}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(apiError(err, 'Erreur lors du téléchargement'));
    } finally {
      setDownloading(false);
    }
  }, [items, view, full, message]);

  // The grid only has the thumbnail. The open slide loads the product's full photo.
  useEffect(() => {
    if (view == null || !items?.[view]) return undefined;
    const item = items[view];
    setFull(item.thumb_data || null);
    const known = cache.current[item.product_id];
    let live = true;
    const show = (images) => {
      const photo = images.find((img) => img.id === item.id);
      if (live) setFull(photo?.image_data || item.thumb_data || null);
    };
    if (known) show(known);
    else {
      axios.get(`${API_BASE_URL}/products/${item.product_id}`)
        .then((r) => {
          const images = r.data.data.images || [];
          cache.current[item.product_id] = images;
          show(images);
        })
        .catch(() => {});
    }
    return () => { live = false; };
  }, [view, items]);

  useEffect(() => {
    if (view == null) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setView(null);
      if (e.key === 'ArrowRight') setView((i) => Math.min(items.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setView((i) => Math.max(0, i - 1));
      if (e.key === 'Enter') openProduct(view);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [view, items, openProduct]);

  const clearHold = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };

  // Full screen: a drag moves between photos; a click or a long press opens the fiche.
  const onPointerDown = (e) => {
    if (e.target.closest('button')) return;
    if (e.button != null && e.button !== 0) return;
    held.current = false;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    clearHold();
    hold.current = setTimeout(() => {
      held.current = true;
      drag.current = null;
      openProduct(view);
    }, 500);
  };
  const onPointerMove = (e) => {
    const start = drag.current;
    if (!start) return;
    if (Math.abs(e.clientX - start.x) > 12 || Math.abs(e.clientY - start.y) > 12) {
      start.moved = true;
      clearHold();
    }
  };
  const onPointerUp = (e) => {
    clearHold();
    const start = drag.current;
    drag.current = null;
    if (!start || held.current) return;
    const dx = e.clientX - start.x;
    if (start.moved && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
      setView((i) => (dx < 0 ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1)));
      return;
    }
    if (!start.moved) openProduct(view);
  };

  if (error) return <Alert type="error" showIcon message={error} />;
  if (!items) return <div className="text-center py-5"><Spin /></div>;
  if (items.length === 0) {
    return <Empty description={filtered ? 'Aucune photo pour ce filtre.' : "Aucun produit n'a de photo."} className="py-4" />;
  }

  const slide = view != null ? items[view] : null;
  const from = view == null ? 0 : Math.max(0, view - 8);
  const strip = view == null ? [] : items.slice(from, view + 9);

  return (
    <>
      <p className="text-secondary small mb-3">
        Toutes les photos des produits. Ouvrir une photo, glisser pour la suivante.
        Un clic ou un appui long ouvre la fiche, et Retour revient ici.
      </p>
      <div className="galerie-grid">
        {items.map((item, index) => (
          <div key={item.id} className={`galerie-cell-wrap${selected.includes(item.id) ? ' is-selected' : ''}`}>
            <Checkbox className="galerie-check" checked={selected.includes(item.id)} aria-label={`Cocher ${item.name}`}
              onClick={(e) => e.stopPropagation()} onChange={() => onToggle?.(item.id)} />
            <button type="button" className="galerie-cell" title={item.name}
            onClick={() => {
              if (held.current) { held.current = false; return; }
              setView(index);
            }}
            onPointerDown={(e) => {
              held.current = false;
              clearHold();
              hold.current = setTimeout(() => {
                held.current = true;
                openProduct(index);
              }, 500);
              e.currentTarget.setPointerCapture?.(e.pointerId);
            }}
            onPointerUp={clearHold}
            onPointerLeave={clearHold}
            onContextMenu={(e) => { e.preventDefault(); openProduct(index); }}>
            {item.thumb_data
              ? <img src={item.thumb_data} alt={item.name} draggable={false} />
              : <PictureOutlined />}
          </button>
          </div>
        ))}
      </div>

      {slide && (
        <div className="galerie-full" role="dialog" aria-modal="true" aria-label={`Photo de ${slide.name}`}>
          <div className="galerie-full-bar">
            <Button type="text" className="galerie-full-btn" icon={<CloseOutlined />} aria-label="Fermer la galerie" onClick={() => setView(null)} />
            <div className="galerie-full-title text-truncate">{slide.name}</div>
            <span className="galerie-full-count">{view + 1} / {items.length}</span>
          </div>
          <div className="galerie-stage"
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <button type="button" className="galerie-arrow galerie-arrow-left" aria-label="Photo précédente"
              disabled={view === 0} onClick={() => setView((i) => Math.max(0, i - 1))}><LeftOutlined /></button>
            {full ? <img src={full} alt={slide.name} className="galerie-shot" draggable={false} /> : <PictureOutlined className="galerie-shot-empty" />}
            <button type="button" className="galerie-arrow galerie-arrow-right" aria-label="Photo suivante"
              disabled={view >= items.length - 1} onClick={() => setView((i) => Math.min(items.length - 1, i + 1))}><RightOutlined /></button>
          </div>
          <div className="galerie-full-foot">
            <div className="galerie-strip">
              {strip.map((item, offset) => {
                const index = from + offset;
                return (
                  <button key={item.id} type="button" className={`galerie-strip-cell ${index === view ? 'is-active' : ''}`}
                    onClick={() => setView(index)} aria-label={item.name}>
                    {item.thumb_data ? <img src={item.thumb_data} alt="" draggable={false} /> : <PictureOutlined />}
                  </button>
                );
              })}
            </div>
            <div className="galerie-full-actions">
              <Button icon={<DownloadOutlined />} loading={downloading} disabled={!full} onClick={download}>Télécharger</Button>
              <Button type="primary" onClick={() => openProduct(view)}>Voir la fiche</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
