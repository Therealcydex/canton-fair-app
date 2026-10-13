import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input } from 'antd';
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

  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light px-3">
      <Card title="Sourcing — Connexion" style={{ width: '100%', maxWidth: 380 }}>
        {error && <Alert type="error" message={error} showIcon className="mb-3" />}
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item label="Nom d'utilisateur" name="username"
            rules={[{ required: true, message: "Saisissez votre nom d'utilisateur" }]}>
            <Input autoFocus autoComplete="username" />
          </Form.Item>
          <Form.Item label="Mot de passe" name="password"
            rules={[{ required: true, message: 'Saisissez votre mot de passe' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>Se connecter</Button>
        </Form>
      </Card>
    </div>
  );
}
