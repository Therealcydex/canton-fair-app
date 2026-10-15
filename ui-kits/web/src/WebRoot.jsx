import { App as AntApp, ConfigProvider } from 'antd';
import frFR from 'antd/locale/fr_FR';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../frontend/src/context/AuthContext';

const DEMO_USER = { id: 1, name: 'Sami Ben Ali', username: 'sami.benali', role: 'ADMIN', company_name: 'Groupe Tarek', company_branch: 'Tunis' };

// The web app's providers (frontend/src/App.js) around a design: French Ant Design locale,
// AntApp (message, modal), the signed-in user AppLayout shows, and a router.
// AuthProvider reads the signed-in user from localStorage when it mounts, so it is seeded first.
export function WebRoot({ user = DEMO_USER, initialPath = '/', children }) {
  try { localStorage.setItem('authUser', JSON.stringify(user)); } catch { /* private mode */ }
  return (
    <ConfigProvider locale={frFR}>
      <AntApp>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}
