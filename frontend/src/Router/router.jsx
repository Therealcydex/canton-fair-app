import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { RequireAccess, RequireAuth } from '../components/Guards';
import { isAdmin } from '../utils/access';
import Login from '../feature-module/auth/Login';
import Accueil from '../feature-module/accueil/Accueil';
import Users from '../feature-module/admin/Users';
import Companies from '../feature-module/admin/Companies';
import Suppliers from '../feature-module/suppliers/Suppliers';
import SupplierDetail from '../feature-module/suppliers/SupplierDetail';
import Contacts from '../feature-module/contacts/Contacts';
import ContactQrSheet from '../feature-module/contacts/ContactQrSheet';
import Booths from '../feature-module/booths/Booths';
import BoothDetail from '../feature-module/booths/BoothDetail';
import Products from '../feature-module/products/Products';
import ProductDetail from '../feature-module/products/ProductDetail';
import FairPlan from '../feature-module/fair/FairPlan';

// The old booth addresses ("/stands/12", before booths were called booths) still open the page.
function OldBoothLink() {
  const { id } = useParams();
  return <Navigate to={id ? `/booths/${id}` : '/booths'} replace />;
}

// One route per page; module pages live in src/feature-module/<module>/.
export default function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Accueil />} />
            <Route path="/fournisseurs" element={<Suppliers />} />
            <Route path="/fournisseurs/:id" element={<SupplierDetail />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/contacts/qr" element={<ContactQrSheet />} />
            <Route path="/a-visiter" element={<Booths planning key="planning" />} />
            <Route path="/booths" element={<Booths key="all" />} />
            <Route path="/booths/:id" element={<BoothDetail />} />
            <Route path="/stands" element={<OldBoothLink />} />
            <Route path="/stands/:id" element={<OldBoothLink />} />
            <Route path="/produits" element={<Products />} />
            <Route path="/produits/:id" element={<ProductDetail />} />
            <Route path="/plan-du-salon" element={<FairPlan />} />
            <Route element={<RequireAccess allow={isAdmin} />}>
              <Route path="/admin/utilisateurs" element={<Users />} />
              <Route path="/admin/societes" element={<Companies />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
