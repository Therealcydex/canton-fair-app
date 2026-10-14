import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isCompanyAdmin, isSuperAdmin } from '../utils/access';

// Menu entries; `show` hides an entry the user cannot use (the server refuses anyway).
const MENU = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/fournisseurs', label: 'Fournisseurs' },
  { to: '/a-visiter', label: 'À visiter' },
  { to: '/stands', label: 'Stands' },
  { to: '/visites', label: 'Visites' },
  { to: '/produits', label: 'Produits' },
];
const ADMIN_MENU = [
  { to: '/admin/utilisateurs', label: 'Utilisateurs', show: isCompanyAdmin },
  { to: '/admin/societes', label: 'Sociétés', show: isSuperAdmin },
  { to: '/admin/categories', label: 'Catégories', show: isSuperAdmin },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const adminItems = ADMIN_MENU.filter((m) => m.show(user));

  return (
    <>
      <Navbar bg="dark" variant="dark" expand="md" collapseOnSelect>
        <Container fluid>
          <Navbar.Brand as={NavLink} to="/">Sourcing</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="me-auto">
              {MENU.map((m) => (
                <Nav.Link key={m.to} as={NavLink} to={m.to} end={m.end} eventKey={m.to}>{m.label}</Nav.Link>
              ))}
              {adminItems.length > 0 && (
                <NavDropdown title="Administration" id="admin-menu">
                  {adminItems.map((m) => (
                    <NavDropdown.Item key={m.to} as={NavLink} to={m.to} eventKey={m.to}>{m.label}</NavDropdown.Item>
                  ))}
                </NavDropdown>
              )}
            </Nav>
            <Nav>
              <NavDropdown align="end" title={`${user.name} · ${user.company_name}`} id="user-menu">
                <NavDropdown.Item onClick={() => { logout(); navigate('/login'); }}>Se déconnecter</NavDropdown.Item>
              </NavDropdown>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container fluid className="py-3 px-3 px-md-4">
        <Outlet />
      </Container>
    </>
  );
}
