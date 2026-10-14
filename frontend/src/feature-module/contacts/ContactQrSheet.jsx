import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, Empty, Space, Spin } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { useQrImage } from '../../utils/qr';

// The QR code of a card: the photo, or a QR code drawn from the scanned link (D34).
function CardQr({ value, name }) {
  const image = useQrImage(value);
  return image ? <img src={image} alt={`QR code WeChat de ${name || 'ce contact'}`} /> : <div className="qr-card-pending" />;
}

// A sheet of the contacts' WeChat QR codes to print (BF17): the contacts of the Contacts page's
// filters that have a QR photo, one card each. The print style (index.css) hides the menu and
// the buttons and keeps each card on one page.
export default function ContactQrSheet() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const sheet = useRef(null);

  useEffect(() => {
    const query = Object.fromEntries(params);
    axios.get(`${API_BASE_URL}/contacts`, { params: { ...query, has_qr: '1' } })
      .then((r) => setRows(r.data.data))
      .catch((err) => setError(apiError(err, 'Erreur lors du chargement des contacts')));
  }, [params]);

  // Prints once every QR image is loaded, so none is missing on paper.
  const print = async () => {
    // Drawn QR codes appear a moment after the page: wait until every card has its image.
    for (let i = 0; i < 50 && sheet.current?.querySelector('.qr-card-pending'); i++) {
      await new Promise((done) => setTimeout(done, 100));
    }
    const images = [...(sheet.current?.querySelectorAll('img') || [])];
    await Promise.all(images.map((img) => (img.complete ? null : new Promise((done) => { img.onload = done; img.onerror = done; }))));
    window.print();
  };

  return (
    <>
      <Space className="mb-3 w-100 justify-content-between no-print" wrap>
        <div>
          <Link to="/contacts">← Contacts</Link>
          <h1 className="h4 m-0 mt-1">QR codes WeChat à imprimer</h1>
        </div>
        <Button type="primary" onClick={print} disabled={!rows?.length}>Imprimer</Button>
      </Space>
      {error && <Alert type="error" message={error} showIcon className="mb-3" />}
      {!rows && !error && <div className="text-center py-5"><Spin /></div>}
      {rows?.length === 0 && <Empty description="Aucun contact avec un QR code WeChat pour ces filtres" />}
      {rows?.length > 0 && (
        <>
          <p className="text-muted no-print">{rows.length} QR code(s). À l'impression : 3 cartes par ligne sur une page A4, aucune carte coupée entre deux pages.</p>
          <div className="qr-sheet" ref={sheet}>
            {rows.map((c) => (
              <div key={c.id} className="qr-card">
                <CardQr value={c.wechat_qr} name={c.name} />
                <div className="qr-card-name">{c.name || '—'}</div>
                {c.phone && <div>{c.phone}</div>}
                <div className="text-muted">{c.supplier_name}</div>
                <div className="text-muted small">Fournisseur n° {c.supplier_id} · Contact n° {c.id}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
