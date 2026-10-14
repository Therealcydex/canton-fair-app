import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, jsonBody } from '../config/api';
import { useAuth } from '../authContext';
import { companyLabel } from '../format';
import type { Company } from '../types';
import { Button, ErrorBox, Field, Notice, inputClass } from '../components/ui';

// Public sign-up (BF16): the account is created inactive; the admin activates it.
// The rules (username format, password length, taken username) are the server's.
export default function SignUp() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState({ name: '', company_id: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Company[]>('/signup/companies', 'Impossible de charger la liste des sociétés')
      .then(setCompanies)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (user) return <Navigate to="/" replace />;

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Les mots de passe ne correspondent pas');
    setSaving(true);
    setError(null);
    try {
      await api('/signup', 'Inscription impossible', {
        method: 'POST',
        body: jsonBody({ name: form.name, company_id: form.company_id || null, username: form.username.trim(), password: form.password }),
      });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow">
        <h1 className="text-xl font-semibold">Créer un compte</h1>
        {done ? (
          <>
            <Notice message="Demande envoyée. Votre compte doit être validé par l'administrateur avant votre première connexion." />
            <Link to="/login" className="block text-center text-blue-700">Retour à la connexion</Link>
          </>
        ) : (
          <>
            <ErrorBox message={error} />
            <Field label="Nom complet">
              <input className={inputClass} value={form.name} onChange={set('name')} maxLength={150} autoComplete="name" required />
            </Field>
            <Field label="Société">
              <select className={inputClass} value={form.company_id} onChange={set('company_id')} required>
                <option value="">Choisir…</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{companyLabel(c)}</option>)}
              </select>
            </Field>
            <Field label="Nom d'utilisateur" hint="3 à 50 caractères : lettres, chiffres, . _ -">
              <input className={inputClass} value={form.username} onChange={set('username')} maxLength={50}
                autoComplete="username" autoCapitalize="none" required />
            </Field>
            <Field label="Mot de passe" hint="Au moins 8 caractères">
              <input className={inputClass} type="password" value={form.password} onChange={set('password')}
                autoComplete="new-password" minLength={8} required />
            </Field>
            <Field label="Confirmer le mot de passe">
              <input className={inputClass} type="password" value={form.confirm} onChange={set('confirm')}
                autoComplete="new-password" required />
            </Field>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Envoi…' : 'Créer mon compte'}</Button>
            <p className="text-center text-sm">Déjà un compte ? <Link to="/login" className="text-blue-700">Se connecter</Link></p>
          </>
        )}
      </form>
    </div>
  );
}
