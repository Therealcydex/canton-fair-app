import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth';
import { useAuth } from './authContext';
import { Account, TabsLayout } from './components/ui';
import Login from './pages/Login';
import BoothsPage from './pages/BoothsPage';
import BoothPage from './pages/BoothPage';
import ProductNew from './pages/ProductNew';
import SuppliersPage from './pages/SuppliersPage';
import SupplierPage from './pages/SupplierPage';

function RequireAuth() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

// HashRouter: the app is served from files inside the Android package (Capacitor).
export default function App() {
  return (
    <AuthProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<TabsLayout />}>
              <Route path="/" element={<BoothsPage planning key="planning" />} />
              <Route path="/stands" element={<BoothsPage planning={false} key="all" />} />
              <Route path="/fournisseurs" element={<SuppliersPage />} />
              <Route path="/compte" element={<Account />} />
            </Route>
            <Route path="/stands/:id" element={<BoothPage />} />
            <Route path="/fournisseurs/:id" element={<SupplierPage />} />
            <Route path="/produits/nouveau" element={<ProductNew />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
