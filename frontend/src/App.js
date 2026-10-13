import { App as AntApp, ConfigProvider } from 'antd';
import frFR from 'antd/locale/fr_FR';
import { AuthProvider } from './context/AuthContext';
import AppRouter from './Router/router';

export default function App() {
  return (
    <ConfigProvider locale={frFR}>
      <AntApp>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}
