import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, jsonBody } from '../config/api';
import CardScanButton from '../components/CardScanButton';
import { ContactFields } from '../components/ContactFields';
import { emptyContact, saveContact, type ContactValues } from '../contact';
import { Button, ErrorBox, Field, Notice, Page, inputClass } from '../components/ui';

// A new supplier met on the fair floor, with its contact, usually read from the business card
// (D37): the company and website go to the supplier, the person to the contact. The buyer checks
// the fields; the server validates them. If the contact is refused after the supplier was saved,
// only the contact is sent again.
export default function SupplierNew() {
  const navigate = useNavigate();
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');
  const [fairUrl, setFairUrl] = useState(''); // D42: the exhibitor's page on cantonfair.org.cn
  const [contact, setContact] = useState<ContactValues>(emptyContact);
  const [supplierId, setSupplierId] = useState<number | null>(null); // set once saved
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasContact = Object.values(contact).some((v) => v.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let id = supplierId;
    try {
      if (!id) {
        const created = await api<{ id: number }>('/suppliers', "Erreur lors de l'enregistrement du fournisseur", {
          method: 'POST',
          body: jsonBody({ name: company.trim(), website: website.trim() || null, cantonfair_url: fairUrl.trim() || null }),
        });
        id = created.id;
        setSupplierId(id);
      }
      if (hasContact) await saveContact(id, contact);
      navigate(`/fournisseurs/${id}`, { replace: true });
    } catch (err) {
      setError(id ? `Fournisseur enregistré, mais pas le contact : ${(err as Error).message}` : (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="Nouveau fournisseur" back>
      <form onSubmit={submit} className="space-y-3">
        <CardScanButton onRead={(f) => {
          if (!supplierId) {
            if (f.company) setCompany(f.company);
            if (f.website) setWebsite(f.website);
          }
          setContact((v) => ({ name: f.name || v.name, phone: f.phone || v.phone, email: f.email || v.email, wechat: f.wechat || v.wechat }));
        }} />
        <ErrorBox message={error} />
        {supplierId && <Notice message="Fournisseur enregistré. Corrigez le contact puis réessayez, ou revenez en arrière." />}
        <fieldset disabled={!!supplierId} className="space-y-3">
          <Field label="Société (fournisseur)">
            <input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} required />
          </Field>
          <Field label="Site web">
            <input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={255} autoCapitalize="none" />
          </Field>
          <Field label="Page sur le site du salon" hint="Facultatif : l'adresse de la page de l'exposant sur cantonfair.org.cn">
            <input className={inputClass} value={fairUrl} onChange={(e) => setFairUrl(e.target.value)} maxLength={255}
              type="url" inputMode="url" autoCapitalize="none" placeholder="https://www.cantonfair.org.cn/…" />
          </Field>
        </fieldset>
        <h2 className="px-1 pt-2 font-semibold">Contact</h2>
        <ContactFields values={contact} onChange={setContact} />
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Enregistrement…' : supplierId ? 'Renvoyer le contact' : 'Enregistrer'}
        </Button>
      </form>
    </Page>
  );
}
