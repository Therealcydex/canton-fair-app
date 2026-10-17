import { useState } from 'react';
import { Nav, Offcanvas } from 'react-bootstrap';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ApartmentOutlined, AuditOutlined, BankOutlined, ContactsOutlined, FlagOutlined, HomeOutlined,
  InboxOutlined, LogoutOutlined, MenuOutlined, ShopOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/access';
import { companyLabel } from '../utils/lists';
import Logo from './Logo';

// Menu entries; `show` hides an entry the user cannot use (the server refuses anyway).
const MENU = [
  { to: '/', label: 'Accueil', icon: <HomeOutlined />, end: true },
  { to: '/fournisseurs', label: 'Fournisseurs', icon: <BankOutlined /> },
  { to: '/contacts', label: 'Contacts', icon: <ContactsOutlined /> },
  { to: '/a-visiter', label: 'À visiter', icon: <FlagOutlined /> },
  { to: '/booths', label: 'Booths', icon: <ShopOutlined /> },
  { to: '/produits', label: 'Produits', icon: <InboxOutlined /> },
  { to: '/revue', label: 'Revue du soir', icon: <AuditOutlined /> }, // D38
];
// D52: on a phone, the screens used on the fair floor stay one tap away at the bottom.
const TABS = [
  { to: '/a-visiter', label: 'À visiter', icon: <FlagOutlined /> },
  { to: '/fournisseurs', label: 'Fournisseurs', icon: <BankOutlined /> },
  { to: '/produits', label: 'Produits', icon: <InboxOutlined /> },
  { to: '/revue', label: 'Revue', icon: <AuditOutlined /> },
];
const ADMIN_MENU = [
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: <TeamOutlined />, show: isAdmin },
  { to: '/admin/societes', label: 'Sociétés', icon: <ApartmentOutlined />, show: isAdmin },
];

const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// Side bar, page and footer (D49): on large screens it shows when the pointer reaches the left edge,
// on small ones it is a drawer opened from the top bar.
export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const adminItems = ADMIN_MENU.filter((m) => m.show(user));
  const company = user.company_name ? companyLabel({ name: user.company_name, branch: user.company_branch }) : null;
  const close = () => setOpen(false);

  const link = (m) => (
    <Nav.Link key={m.to} as={NavLink} to={m.to} end={m.end} onClick={close}>
      <span className="app-side-icon">{m.icon}</span>{m.label}
    </Nav.Link>
  );

  const sidebar = (
    <div className="app-side">
      <NavLink to="/" className="app-brand" onClick={close}><Logo />Sourcing</NavLink>
      <Nav className="flex-column flex-nowrap app-side-nav">
        {MENU.map(link)}
        {adminItems.length > 0 && (
          <>
            <div className="app-side-section">Administration</div>
            {adminItems.map(link)}
          </>
        )}
      </Nav>
      <div className="app-side-user">
        <span className="app-avatar">{initials(user.name)}</span>
        <span className="flex-grow-1 lh-sm overflow-hidden">
          <span className="d-block text-white text-truncate">{user.name}</span>
          {company && <span className="d-block small text-truncate">{company}</span>}
        </span>
        <button type="button" className="app-side-logout" title="Se déconnecter" aria-label="Se déconnecter"
          onClick={() => { logout(); navigate('/login'); }}>
          <LogoutOutlined />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Large screens: hidden, it slides in when the pointer reaches the left edge (the zone) and stays while hovered. */}
      <div className="app-side-zone d-none d-lg-block" aria-hidden="true"><span className="app-side-handle" /></div>
      <aside className="app-sidebar d-none d-lg-flex">{sidebar}</aside>
      <header className="app-topbar-sm d-lg-none">
        <button type="button" className="app-menu-btn" aria-label="Ouvrir le menu" onClick={() => setOpen(true)}>
          <MenuOutlined />
        </button>
        <NavLink to="/" className="app-brand"><Logo size={26} />Sourcing</NavLink>
      </header>
      <Offcanvas show={open} onHide={close} className="app-offcanvas d-lg-none">
        {sidebar}
      </Offcanvas>
      <div className="app-content">
        <main className="app-main py-4 px-3 px-md-4">
          <Outlet />
        </main>
        <footer className="app-footer d-flex flex-wrap justify-content-between gap-2 px-3 px-md-4 py-2">
          <span>Sourcing · Foire de Canton, Guangzhou (Pazhou)</span>
          <span>Données partagées par le groupe</span>
        </footer>
      </div>
      <nav className="app-tabbar d-lg-none" aria-label="Accès rapide">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className="app-tab">
            <span className="app-tab-icon">{t.icon}</span>{t.label}
          </NavLink>
        ))}
        <button type="button" className="app-tab" onClick={() => setOpen(true)}>
          <span className="app-tab-icon"><MenuOutlined /></span>Menu
        </button>
      </nav>
    </>
  );
}
