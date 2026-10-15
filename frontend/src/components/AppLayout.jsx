import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/access';
import { companyLabel } from '../utils/lists';
import Logo from './Logo';

// Menu entries; `show` hides an entry the user cannot use (the server refuses anyway).
const MENU = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/fournisseurs', label: 'Fournisseurs' },
  { to: '/contacts', label: 'Contacts' },
  { to: '/a-visiter', label: 'À visiter' },
  { to: '/booths', label: 'Booths' },
  { to: '/produits', label: 'Produits' },
  { to: '/plan-du-salon', label: 'Plan du salon' }, // D42
];
const ADMIN_MENU = [
  { to: '/admin/utilisateurs', label: 'Utilisateurs', show: isAdmin },
  { to: '/admin/societes', label: 'Sociétés', show: isAdmin },
];

const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// Top bar, page and footer from the Stitch screens (D49).
export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const adminItems = ADMIN_MENU.filter((m) => m.show(user));
  const company = user.company_name ? companyLabel({ name: user.company_name, branch: user.company_branch }) : null;

  const userTitle = (
    <span className="app-user">
      <span className="app-avatar">{initials(user.name)}</span>
      <span className="lh-sm text-start">
        <span className="d-block text-white">{user.name}</span>
        {company && <span className="d-block small">{company}</span>}
      </span>
    </span>
  );

  return (
    <>
      <Navbar variant="dark" expand="lg" collapseOnSelect className="app-topbar">
        <Container fluid>
          <Navbar.Brand as={NavLink} to="/" className="app-brand"><Logo />Sourcing</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="me-auto">
              {MENU.map((m) => (
                <Nav.Link key={m.to} as={NavLink} to={m.to} end={m.end} eventKey={m.to}>{m.label}</Nav.Link>
              ))}
              {adminItems.length > 0 && (
                <NavDropdown title="Administration" id="admin-menu" active={pathname.startsWith('/admin/')}>
                  {adminItems.map((m) => (
                    <NavDropdown.Item key={m.to} as={NavLink} to={m.to} eventKey={m.to}>{m.label}</NavDropdown.Item>
                  ))}
                </NavDropdown>
              )}
            </Nav>
            <Nav>
              <NavDropdown align="end" title={userTitle} id="user-menu">
                <NavDropdown.Item onClick={() => { logout(); navigate('/login'); }}>Se déconnecter</NavDropdown.Item>
              </NavDropdown>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container fluid className="app-main py-4 px-3 px-md-4">
        <Outlet />
      </Container>
      <footer className="app-footer d-flex flex-wrap justify-content-between gap-2 px-3 px-md-4 py-2">
        <span>Sourcing · Foire de Canton, Guangzhou (Pazhou)</span>
        <span>Données partagées par le groupe</span>
      </footer>
    </>
  );
}
