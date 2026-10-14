import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { RequireAccess, RequireAuth } from '../components/Guards';
import { isCompanyAdmin, isSuperAdmin } from '../utils/access';
import Login from '../feature-module/auth/Login';
import Accueil from '../feature-module/accueil/Accueil';
import Users from '../feature-module/admin/Users';
import Companies from '../feature-module/admin/Companies';
import Suppliers from '../feature-module/suppliers/Suppliers';
import SupplierDetail from '../feature-module/suppliers/SupplierDetail';
import Booths from '../feature-module/booths/Booths';
import BoothDetail from '../feature-module/booths/BoothDetail';
import Visits from '../feature-module/booths/Visits';
import Categories from '../feature-module/admin/Categories';
import Products from '../feature-module/products/Products';
import ProductDetail from '../feature-module/products/ProductDetail';

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
            <Route path="/a-visiter" element={<Booths planning key="planning" />} />
            <Route path="/stands" element={<Booths key="all" />} />
            <Route path="/stands/:id" element={<BoothDetail />} />
            <Route path="/visites" element={<Visits />} />
            <Route path="/produits" element={<Products />} />
            <Route path="/produits/:id" element={<ProductDetail />} />
            <Route element={<RequireAccess allow={isCompanyAdmin} />}>
              <Route path="/admin/utilisateurs" element={<Users />} />
            </Route>
            <Route element={<RequireAccess allow={isSuperAdmin} />}>
              <Route path="/admin/societes" element={<Companies />} />
              <Route path="/admin/categories" element={<Categories />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
