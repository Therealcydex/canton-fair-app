import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../authContext';
import { Logo } from '../components/icons';
import { Button, ErrorBox, Field, inputClass } from '../components/ui';

export default function Login() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Stitch "Connexion" screen (D49), without its sign-up tab: the administrator creates the accounts (D46).
  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-5 p-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
      <div className="flex items-center gap-3 px-1">
        <Logo size={44} />
        <div>
          <p className="font-display text-xl font-bold uppercase leading-tight">Sourcing</p>
          <p className="text-sm font-medium text-slate-600">Foire de Canton · Guangzhou</p>
        </div>
      </div>
      <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow">
        <div className="flex items-center gap-2 bg-ink px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
          <span className="h-2 w-2 rounded-full bg-green-500" />Complexe de Pazhou
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <div>
            <h1 className="text-2xl font-bold">Connexion</h1>
            <p className="text-sm text-slate-600">Espace réservé aux acheteurs et administrateurs du groupe</p>
          </div>
          <ErrorBox message={error} />
          <Field label="Nom d'utilisateur">
            <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" autoCapitalize="none" required />
          </Field>
          <Field label="Mot de passe">
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" required />
          </Field>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter →'}</Button>
        </form>
        <p className="bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">Pas de compte ? Demandez-le à l'administrateur.</p>
      </div>
    </div>
  );
}
