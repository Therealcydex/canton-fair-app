import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Alert, Button, Card, Form, Input, Result, Select } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { useAuth } from '../../context/AuthContext';
import { apiError } from '../../utils/apiError';
import { companyLabel } from '../../utils/lists';

// Public sign-up (BF16): the account is created inactive; the admin activates it.
export default function SignUp() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/signup/companies`)
      .then((r) => setCompanies(r.data.data))
      .catch((err) => setError(apiError(err, 'Impossible de charger la liste des sociétés')));
  }, []);

  if (user) return <Navigate to="/" replace />;

  const onFinish = async ({ confirm, ...values }) => {
    setError(null);
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/signup`, values);
      setDone(true);
    } catch (err) {
      setError(apiError(err, 'Inscription impossible'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light px-3">
      <Card title="Sourcing — Créer un compte" style={{ width: '100%', maxWidth: 420 }}>
        {done ? (
          <Result status="success" title="Demande envoyée"
            subTitle="Votre compte doit être validé par l'administrateur avant votre première connexion."
            extra={<Link to="/login">Retour à la connexion</Link>} />
        ) : (
          <>
            {error && <Alert type="error" message={error} showIcon className="mb-3" />}
            <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
              <Form.Item label="Nom complet" name="name"
                rules={[{ required: true, whitespace: true, message: 'Saisissez votre nom' }]}>
                <Input maxLength={150} autoFocus autoComplete="name" />
              </Form.Item>
              <Form.Item label="Société" name="company_id" rules={[{ required: true, message: 'Choisissez votre société' }]}>
                <Select showSearch optionFilterProp="label" placeholder="Votre société"
                  options={companies.map((c) => ({ value: c.id, label: companyLabel(c) }))} />
              </Form.Item>
              <Form.Item label="Nom d'utilisateur" name="username" extra="3 à 50 caractères : lettres, chiffres, . _ -"
                rules={[
                  { required: true, message: "Choisissez un nom d'utilisateur" },
                  { pattern: /^[\w.-]{3,50}$/, message: "3 à 50 caractères : lettres, chiffres, . _ -" },
                ]}>
                <Input maxLength={50} autoComplete="username" />
              </Form.Item>
              <Form.Item label="Mot de passe" name="password" extra="Au moins 8 caractères"
                rules={[{ required: true, min: 8, message: 'Au moins 8 caractères' }]}>
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Form.Item label="Confirmer le mot de passe" name="confirm" dependencies={['password']}
                rules={[
                  { required: true, message: 'Confirmez le mot de passe' },
                  ({ getFieldValue }) => ({
                    validator: (_, v) => (!v || v === getFieldValue('password')
                      ? Promise.resolve() : Promise.reject(new Error('Les mots de passe ne correspondent pas'))),
                  }),
                ]}>
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>Créer mon compte</Button>
              <div className="text-center mt-3">
                Déjà un compte ? <Link to="/login">Se connecter</Link>
              </div>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
}
