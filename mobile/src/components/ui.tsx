import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../authContext';
import { companyLabel } from '../format';

// Page with a sticky header; `back` shows a back arrow.
export function Page({ title, back, action, children }: { title: string; back?: boolean; action?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-slate-900 px-3 py-3 text-white" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        {back && (
          <button onClick={() => navigate(-1)} className="-ml-1 rounded px-2 py-1 text-xl leading-none" aria-label="Retour">←</button>
        )}
        <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
        {action}
      </header>
      <main className="space-y-3 p-3">{children}</main>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-white p-3 shadow-sm ${className}`}>{children}</div>;
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-blue-600 text-white active:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-white text-slate-800 border border-slate-300 active:bg-slate-100 disabled:text-slate-400',
    danger: 'bg-white text-red-600 border border-red-300 active:bg-red-50',
  }[variant];
  return <button className={`min-h-[44px] rounded-lg px-4 font-medium ${styles} ${className}`} {...props} />;
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}</div>;
}

export function Notice({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>;
}

export function Loading() {
  return <p className="py-8 text-center text-slate-500">Chargement…</p>;
}

export function Badge({ className = '', children }: { className?: string; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass = 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none';

// Bottom tab bar of the logged-in screens.
const TABS = [
  { to: '/', label: 'À visiter', end: true },
  { to: '/stands', label: 'Stands' },
  { to: '/fournisseurs', label: 'Fournisseurs' },
  { to: '/compte', label: 'Compte' },
];

export function TabsLayout() {
  return (
    <>
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-slate-200 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => `py-3 text-center text-sm ${isActive ? 'font-semibold text-blue-600' : 'text-slate-600'}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export function Account() {
  const { user, logout } = useAuth();
  return (
    <Page title="Compte">
      <Card>
        <p className="font-semibold">{user?.name}</p>
        <p className="text-sm text-slate-600">{[user?.company_name && companyLabel({ name: user.company_name, branch: user.company_branch }), user?.username].filter(Boolean).join(' · ')}</p>
      </Card>
      <Button variant="secondary" className="w-full" onClick={logout}>Se déconnecter</Button>
    </Page>
  );
}
