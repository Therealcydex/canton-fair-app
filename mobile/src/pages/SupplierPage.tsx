import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fileUrl, jsonBody } from '../config/api';
import { formatPrice } from '../format';
import type { Booth, Contact, Product, Supplier } from '../types';
import { Badge, Button, Card, ErrorBox, Field, Loading, Page, inputClass } from '../components/ui';

const MAX_MB = 8;

// D33: wechat_qr is the link of a photo of the WeChat QR code; an older value typed by hand is text.
const isQrPhoto = (value: string | null) => !!value && value.startsWith('/uploads/');

// A contact: tap to call or write, and its WeChat QR code, photographed at the booth
// (tap the QR code to show it full screen and scan it). The server checks the photo.
function ContactCard({ supplierId, contact, onChanged }: { supplierId: number; contact: Contact; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const url = `/suppliers/${supplierId}/contacts/${contact.id}/wechat-qr`;

  const run = async (request: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await request();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const upload = (file?: File) => {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) return setError(`« ${file.name} » dépasse ${MAX_MB} Mo`);
    const body = new FormData();
    body.append('images', file);
    run(() => api(url, "Erreur lors de l'envoi du QR code", { method: 'POST', body }));
  };

  const remove = () => {
    if (window.confirm('Retirer le QR code WeChat de ce contact ?')) {
      run(() => api(url, 'Erreur lors du retrait du QR code', { method: 'DELETE' }));
    }
  };

  return (
    <Card className="space-y-2 text-sm">
      {contact.name && <p className="font-medium">{contact.name}</p>}
      {contact.phone && <p><a className="text-blue-700" href={`tel:${contact.phone}`}>{contact.phone}</a></p>}
      {contact.email && <p><a className="text-blue-700" href={`mailto:${contact.email}`}>{contact.email}</a></p>}
      {contact.wechat_qr && !isQrPhoto(contact.wechat_qr) && <p className="text-slate-600">WeChat : {contact.wechat_qr}</p>}
      {isQrPhoto(contact.wechat_qr) && (
        <button type="button" onClick={() => setZoom(true)} aria-label="Agrandir le QR code WeChat">
          <img src={fileUrl(contact.wechat_qr)} alt="QR code WeChat" className="h-32 w-32 rounded-lg border bg-white object-contain" />
        </button>
      )}
      <ErrorBox message={error} />
      <div className="flex gap-2">
        <label className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-slate-300 px-3 font-medium ${busy ? 'text-slate-400' : 'text-slate-800 active:bg-slate-100'}`}>
          {busy ? 'Envoi…' : isQrPhoto(contact.wechat_qr) ? 'Reprendre le QR WeChat' : 'Photographier le QR WeChat'}
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={busy}
            onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {contact.wechat_qr && <Button variant="danger" disabled={busy} onClick={remove}>Retirer</Button>}
      </div>
      {zoom && isQrPhoto(contact.wechat_qr) && (
        <button type="button" className="fixed inset-0 z-20 flex items-center justify-center bg-black/80 p-6" onClick={() => setZoom(false)}
          aria-label="Fermer">
          <img src={fileUrl(contact.wechat_qr)} alt="QR code WeChat" className="max-h-full max-w-full rounded-lg bg-white object-contain" />
        </button>
      )}
    </Card>
  );
}

// A quick contact (name, phone), so a QR code can be photographed for a supplier that has none yet.
function NewContact({ supplierId, onSaved }: { supplierId: number; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/suppliers/${supplierId}/contacts`, "Erreur lors de l'enregistrement du contact", {
        method: 'POST',
        body: jsonBody({ name: name.trim() || null, phone: phone.trim() || null }),
      });
      setName('');
      setPhone('');
      setOpen(false);
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>+ Contact</Button>;
  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <ErrorBox message={error} />
        <Field label="Nom"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={150} /></Field>
        <Field label="Téléphone"><input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} inputMode="tel" /></Field>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
        </div>
      </form>
    </Card>
  );
}

// Supplier lookup on the fair floor: contacts and their WeChat QR codes, booths, products.
export default function SupplierPage() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadSupplier = useCallback(
    () => api<Supplier>(`/suppliers/${id}`, 'Erreur lors du chargement du fournisseur').then(setSupplier),
    [id]
  );

  useEffect(() => {
    Promise.all([
      loadSupplier(),
      api<Booth[]>(`/booths?supplier_id=${id}`, 'Erreur lors du chargement des stands').then(setBooths),
      api<Product[]>(`/products?supplier_id=${id}`, 'Erreur lors du chargement des produits').then(setProducts),
    ]).catch((e: Error) => setError(e.message));
  }, [id, loadSupplier]);

  if (!supplier) return <Page title="Fournisseur" back>{error ? <ErrorBox message={error} /> : <Loading />}</Page>;

  return (
    <Page title={supplier.name} back
      action={<Link to={`/produits/nouveau?supplier=${supplier.id}`} className="rounded bg-blue-600 px-2 py-1 text-sm">+ Produit</Link>}>
      <Card className="space-y-1 text-sm">
        {(supplier.province || supplier.rating) && <p>{[supplier.province, supplier.rating ? '★'.repeat(supplier.rating) : null].filter(Boolean).join(' · ')}</p>}
        <p className="text-slate-600">{supplier.nbr_booths ? `${supplier.booth_visit_pct} % des ${supplier.nbr_booths} stand(s) visités` : 'Aucun stand'}</p>
        {supplier.phone && <p><a className="text-blue-700" href={`tel:${supplier.phone}`}>{supplier.phone}</a></p>}
        {supplier.email && <p><a className="text-blue-700" href={`mailto:${supplier.email}`}>{supplier.email}</a></p>}
        {supplier.address && <p className="text-slate-600">{supplier.address}</p>}
        {supplier.notes && <p className="whitespace-pre-wrap text-slate-600">{supplier.notes}</p>}
      </Card>

      <h2 className="px-1 pt-2 font-semibold">Contacts ({supplier.contacts?.length || 0})</h2>
      {supplier.contacts?.map((c) => (
        <ContactCard key={c.id} supplierId={supplier.id} contact={c} onChanged={loadSupplier} />
      ))}
      <NewContact supplierId={supplier.id} onSaved={loadSupplier} />

      <h2 className="px-1 pt-2 font-semibold">Stands ({booths.length})</h2>
      {booths.map((b) => (
        <Link key={b.id} to={`/stands/${b.id}`} className="block">
          <Card className="flex items-center justify-between active:bg-slate-50">
            <span className="font-bold">{b.booth_code}</span>
            {b.visited
              ? <Badge className="bg-green-100 text-green-800">Visité</Badge>
              : <Badge className="bg-orange-100 text-orange-800">À visiter</Badge>}
          </Card>
        </Link>
      ))}

      <h2 className="px-1 pt-2 font-semibold">Produits ({products.length})</h2>
      {products.map((p) => (
        <Card key={p.id} className="text-sm">
          <p className="font-medium">{p.name}</p>
          <p className="text-slate-600">{formatPrice(p.price)}{p.unit ? ` / ${p.unit}` : ''}{p.moq ? ` · MOQ ${p.moq}` : ''}{p.shipping_type ? ` · ${p.shipping_type}` : ''}</p>
        </Card>
      ))}
    </Page>
  );
}
