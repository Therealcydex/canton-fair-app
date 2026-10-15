import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the login page when logged out', () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByText('Sourcing — Connexion')).toBeInTheDocument();
  expect(screen.getByText('Se connecter')).toBeInTheDocument();
});

// D46: no sign-up, the admin creates the accounts.
test('the login page has no sign-up link', () => {
  localStorage.clear();
  render(<App />);
  expect(screen.queryByText('Créer un compte')).not.toBeInTheDocument();
  expect(screen.getByText("Pas de compte ? Demandez-le à l'administrateur.")).toBeInTheDocument();
});
