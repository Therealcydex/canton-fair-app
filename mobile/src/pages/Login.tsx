import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../authContext';
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

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow">
        <h1 className="text-xl font-semibold">Sourcing</h1>
        <ErrorBox message={error} />
        <Field label="Nom d'utilisateur">
          <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)}
            autoComplete="username" autoCapitalize="none" required />
        </Field>
        <Field label="Mot de passe">
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required />
        </Field>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</Button>
        <p className="text-center text-sm">Pas encore de compte ? <Link to="/inscription" className="text-blue-700">Créer un compte</Link></p>
      </form>
    </div>
  );
}
