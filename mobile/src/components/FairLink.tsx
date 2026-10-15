import { useState, type FormEvent } from 'react';
import { api, jsonBody } from '../config/api';
import { ErrorBox, inputClass } from './ui';

// D42: the supplier's page on the fair's site (cantonfair.org.cn): a link to open it, and a small
// form to add or change it. The server only accepts an address of that site and explains a refusal.
export default function FairLink({ supplierId, url, onSaved }: { supplierId: number; url: string | null; onSaved: () => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(url || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/suppliers/${supplierId}`, "La page du salon n'a pas été enregistrée", {
        method: 'PUT', body: jsonBody({ cantonfair_url: value.trim() || null }),
      });
      await onSaved();
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form onSubmit={save} className="space-y-2">
        <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} maxLength={255}
          type="url" inputMode="url" autoCapitalize="none" placeholder="https://www.cantonfair.org.cn/…" aria-label="Page du salon" />
        <ErrorBox message={error} />
        <div className="flex gap-4 text-sm">
          <button type="submit" disabled={saving} className="font-semibold text-blue-700">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          <button type="button" onClick={() => { setEditing(false); setValue(url || ''); setError(null); }} className="text-slate-600">Annuler</button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2">
      {url
        ? <a href={url} target="_blank" rel="noreferrer" className="font-medium text-blue-700">Voir sur le site du salon ↗</a>
        : <span className="text-slate-500">Pas de page du salon</span>}
      <button type="button" onClick={() => { setValue(url || ''); setEditing(true); }} className="text-sm text-blue-700">{url ? 'Modifier' : 'Ajouter'}</button>
    </div>
  );
}
