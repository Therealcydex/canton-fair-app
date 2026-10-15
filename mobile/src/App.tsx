import { HashRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './auth';
import { useAuth } from './authContext';
import { Account, TabsLayout } from './components/ui';
import Login from './pages/Login';
import BoothsPage from './pages/BoothsPage';
import BoothPage from './pages/BoothPage';
import ProductNew from './pages/ProductNew';
import SuppliersPage from './pages/SuppliersPage';
import SupplierPage from './pages/SupplierPage';
import SupplierNew from './pages/SupplierNew';
import ReviewPage from './pages/ReviewPage';
import FairPlanPage from './pages/FairPlanPage';

// The old booth addresses ("#/stands/12", before booths were called booths) still open the page.
function OldBoothLink() {
  const { id } = useParams();
  return <Navigate to={id ? `/booths/${id}` : '/booths'} replace />;
}

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
              <Route path="/booths" element={<BoothsPage planning={false} key="all" />} />
              <Route path="/fournisseurs" element={<SuppliersPage />} />
              <Route path="/revue" element={<ReviewPage />} />
              <Route path="/compte" element={<Account />} />
            </Route>
            <Route path="/booths/:id" element={<BoothPage />} />
            <Route path="/stands" element={<OldBoothLink />} />
            <Route path="/stands/:id" element={<OldBoothLink />} />
            <Route path="/fournisseurs/nouveau" element={<SupplierNew />} />
            <Route path="/fournisseurs/:id" element={<SupplierPage />} />
            <Route path="/produits/nouveau" element={<ProductNew />} />
            <Route path="/plan" element={<FairPlanPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
