import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Input } from 'antd';
import { ArrowRightOutlined, KeyOutlined, UserOutlined } from '@ant-design/icons';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { apiError } from '../../utils/apiError';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onFinish = async ({ username, password }) => {
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(apiError(err, 'Connexion impossible'));
    } finally {
      setLoading(false);
    }
  };

  // Stitch "Connexion" screen (D49), without its sign-up tab: the administrator creates the accounts (D46).
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-strip">
          <span className="rounded-circle" style={{ width: 8, height: 8, background: 'var(--sc-success)' }} />
          Complexe de Pazhou · Foire de Canton
        </div>
        <div className="px-4 pt-4 pb-3">
          <div className="text-center mb-4">
            <Logo size={52} className="app-logo login-logo" />
            <div className="h4 mb-1" style={{ color: 'var(--sc-primary)' }}>
              Sourcing <span className="fw-normal fs-6 text-body">— Foire de Canton</span>
            </div>
            <div className="text-secondary">Espace réservé aux acheteurs et administrateurs du groupe</div>
          </div>
          {error && <Alert type="error" message={error} showIcon className="mb-3" />}
          <Form layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
            <Form.Item label={<><UserOutlined className="me-2" />Nom d'utilisateur</>} name="username"
              rules={[{ required: true, message: "Saisissez votre nom d'utilisateur" }]}>
              <Input autoFocus autoComplete="username" />
            </Form.Item>
            <Form.Item label={<><KeyOutlined className="me-2" />Mot de passe</>} name="password"
              rules={[{ required: true, message: 'Saisissez votre mot de passe' }]}>
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Se connecter <ArrowRightOutlined />
            </Button>
          </Form>
        </div>
        <div className="login-strip justify-content-center login-note">
          Pas de compte ? Demandez-le à l'administrateur.
        </div>
      </div>
    </div>
  );
}
