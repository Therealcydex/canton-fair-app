import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Accueil from '../feature-module/accueil/Accueil';

// One route per page; module pages live in src/feature-module/<module>/.
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Accueil />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
