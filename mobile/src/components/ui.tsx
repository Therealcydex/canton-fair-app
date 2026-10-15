import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../authContext';
import { companyLabel } from '../format';
import { Icon, Logo, type IconName } from './icons';

// Look of the Google Stitch screens (D49): night-blue header, white bordered cards, Space Grotesk titles.

// Page with a sticky header; `back` shows a back arrow, otherwise the app's logo.
export function Page({ title, subtitle, back, action, children }: {
  title: string; subtitle?: string; back?: boolean; action?: ReactNode; children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-ink px-3 py-3 text-white shadow-[0_1px_8px_rgba(0,0,0,0.12)]"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        {back ? (
          <button onClick={() => navigate(-1)} className="-ml-1 flex h-10 w-10 items-center justify-center rounded-md active:bg-white/10" aria-label="Retour">
            <Icon name="back" />
          </button>
        ) : <Logo />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold uppercase tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-blue-300">{subtitle}</p>}
        </div>
        {action}
      </header>
      <main className="space-y-3 p-3">{children}</main>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${className}`}>{children}</div>;
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-blue-600 text-white active:bg-blue-800 disabled:bg-blue-300',
    secondary: 'bg-white text-slate-900 border border-slate-300 active:bg-slate-100 disabled:text-slate-400',
    danger: 'bg-white text-red-600 border border-red-300 active:bg-red-50',
  }[variant];
  return <button className={`min-h-[44px] rounded-md px-4 font-semibold ${styles} ${className}`} {...props} />;
}

// Alerts with the 3px left border of the Stitch design system.
export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div role="alert" className="rounded-md border-l-[3px] border-red-600 bg-red-50 p-3 text-sm text-red-800">{message}</div>;
}

export function Notice({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div role="status" className="rounded-md border-l-[3px] border-green-600 bg-green-50 p-3 text-sm text-green-800">{message}</div>;
}

export function Loading() {
  return <p className="py-8 text-center text-slate-500">Chargement…</p>;
}

export function Badge({ className = '', children }: { className?: string; children: ReactNode }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1 block text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass = 'block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-blue-600 focus:outline-none';

// Bottom tab bar of the logged-in screens.
const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'À visiter', icon: 'flag', end: true },
  { to: '/booths', label: 'Booths', icon: 'booth' },
  { to: '/fournisseurs', label: 'Fournisseurs', icon: 'factory' },
  { to: '/revue', label: 'Revue', icon: 'review' }, // D38: the evening review
  { to: '/compte', label: 'Compte', icon: 'user' },
];

export function TabsLayout() {
  return (
    <>
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-slate-200 bg-white/95 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] tracking-tight ${isActive ? 'font-semibold text-blue-600' : 'text-slate-600'}`}>
            <Icon name={t.icon} />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

const initials = (name?: string) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export function Account() {
  const { user, logout } = useAuth();
  return (
    <Page title="Compte" subtitle="Sourcing · Foire de Canton">
      <Card className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-white">{initials(user?.name)}</span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">{user?.name}</p>
          <p className="truncate text-sm text-slate-600">{[user?.company_name && companyLabel({ name: user.company_name, branch: user.company_branch }), user?.username].filter(Boolean).join(' · ')}</p>
        </div>
      </Card>
      <Button variant="secondary" className="flex w-full items-center justify-center gap-2" onClick={logout}>
        <Icon name="logout" size={18} />Se déconnecter
      </Button>
    </Page>
  );
}
