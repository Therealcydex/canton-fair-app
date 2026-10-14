import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, jsonBody } from '../config/api';
import type { ShippingType, Supplier } from '../types';
import { Button, ErrorBox, Field, Notice, Page, inputClass } from '../components/ui';

const MAX_MB = 8;

// Quick product entry on the fair floor, with photos from the camera (D20). The server
// validates everything; a refusal keeps the form filled and shows its message.
export default function ProductNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const backTo = params.get('stand') ? `/stands/${params.get('stand')}` : null; // the booth page it was opened from
  const [form, setForm] = useState({
    supplier_id: params.get('supplier') || '',
    name: '', supplier_ref: '', price: '', unit: '', moq: '', shipping_type: 'FOB', description: '',
  });
  const [shippingTypes, setShippingTypes] = useState<ShippingType[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [productId, setProductId] = useState<number | null>(null); // set once saved
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // One preview URL per selected photo, released when the selection changes.
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  useEffect(() => {
    api<Supplier[]>('/suppliers', 'Erreur lors du chargement des fournisseurs').then(setSuppliers).catch((e: Error) => setError(e.message));
    api<ShippingType[]>('/lists/shipping-types', 'Erreur').then(setShippingTypes).catch(() => {});
  }, []);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const addPhotos = (list: FileList | null) => {
    const files = Array.from(list || []);
    const tooBig = files.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) return setError(`« ${tooBig.name} » dépasse ${MAX_MB} Mo`);
    setError(null);
    setPhotos((p) => [...p, ...files]);
  };

  const uploadPhotos = async (id: number) => {
    if (photos.length === 0) return;
    const body = new FormData();
    photos.forEach((f) => body.append('images', f));
    await api(`/products/${id}/images`, "Erreur lors de l'envoi des photos", { method: 'POST', body });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let id = productId;
    try {
      if (!id) {
        const created = await api<{ id: number }>('/products', "Erreur lors de l'enregistrement du produit", {
          method: 'POST',
          body: jsonBody({
            supplier_id: form.supplier_id || null,
            name: form.name,
            supplier_ref: form.supplier_ref || null,
            price: form.price.replace(',', '.') || null,
            unit: form.unit || null,
            moq: form.moq || null,
            shipping_type: form.shipping_type,
            description: form.description || null,
          }),
        });
        id = created.id;
        setProductId(id);
      }
      await uploadPhotos(id);
      navigate(backTo || (form.supplier_id ? `/fournisseurs/${form.supplier_id}` : '/'), { replace: true });
    } catch (err) {
      // If the product was saved but the photos were refused, only the photos are sent again.
      setError(id ? `Produit enregistré, mais les photos n'ont pas été envoyées : ${(err as Error).message}` : (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="Nouveau produit" back>
      <form onSubmit={submit} className="space-y-3">
        <ErrorBox message={error} />
        {productId && <Notice message="Produit enregistré. Corrigez les photos puis réessayez, ou revenez en arrière." />}
        <fieldset disabled={!!productId} className="space-y-3">
          <Field label="Fournisseur">
            <select className={inputClass} value={form.supplier_id} onChange={set('supplier_id')}>
              <option value="">Aucun</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Nom du produit">
            <input className={inputClass} value={form.name} onChange={set('name')} maxLength={200} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix">
              <input className={inputClass} value={form.price} onChange={set('price')} inputMode="decimal" placeholder="12,50" />
            </Field>
            <Field label="Unité">
              <input className={inputClass} value={form.unit} onChange={set('unit')} maxLength={30} placeholder="pièce" />
            </Field>
            <Field label="MOQ">
              <input className={inputClass} value={form.moq} onChange={set('moq')} inputMode="numeric" />
            </Field>
            <Field label="Expédition">
              <select className={inputClass} value={form.shipping_type} onChange={set('shipping_type')}>
                {shippingTypes.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Référence fournisseur">
            <input className={inputClass} value={form.supplier_ref} onChange={set('supplier_ref')} maxLength={100} />
          </Field>
          <Field label="Description">
            <textarea className={inputClass} rows={3} value={form.description} onChange={set('description')} />
          </Field>
        </fieldset>

        <Field label={`Photos (${photos.length})`} hint={`JPEG, PNG ou WebP, ${MAX_MB} Mo au plus chacune`}>
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple
            className="block w-full text-sm" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
        </Field>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((f, i) => (
              <button type="button" key={i} onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                className="relative" aria-label={`Retirer ${f.name}`}>
                <img src={previews[i]} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <span className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white">✕</span>
              </button>
            ))}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Enregistrement…' : productId ? 'Renvoyer les photos' : 'Enregistrer'}
        </Button>
      </form>
    </Page>
  );
}
