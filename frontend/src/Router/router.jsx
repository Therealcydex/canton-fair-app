import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { RequireAccess, RequireAuth } from '../components/Guards';
import { isCompanyAdmin, isSuperAdmin } from '../utils/access';
import Login from '../feature-module/auth/Login';
import Accueil from '../feature-module/accueil/Accueil';
import Users from '../feature-module/admin/Users';
import Companies from '../feature-module/admin/Companies';

// One route per page; module pages live in src/feature-module/<module>/.
export default function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Accueil />} />
            <Route element={<RequireAccess allow={isCompanyAdmin} />}>
              <Route path="/admin/utilisateurs" element={<Users />} />
            </Route>
            <Route element={<RequireAccess allow={isSuperAdmin} />}>
              <Route path="/admin/societes" element={<Companies />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
