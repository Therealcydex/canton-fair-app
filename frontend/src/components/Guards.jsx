import { Result } from 'antd';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isViewer } from '../utils/access';

// Not logged in -> login page, then back to the requested page.
export function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

// D66: a viewer (LECTEUR) only has the shared suppliers and their booths; any other page sends it there.
export function RequireBuyer() {
  const { user } = useAuth();
  if (isViewer(user)) return <Navigate to="/fournisseurs" replace />;
  return <Outlet />;
}

// Comfort only: the server also refuses (403) whatever this guard lets through.
export function RequireAccess({ allow }) {
  const { user } = useAuth();
  if (!allow(user)) {
    return <Result status="403" title="Accès refusé" subTitle="Vous n'avez pas les droits nécessaires pour cette page." />;
  }
  return <Outlet />;
}
