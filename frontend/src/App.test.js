import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the login page when logged out', () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByText('Sourcing — Connexion')).toBeInTheDocument();
  expect(screen.getByText('Se connecter')).toBeInTheDocument();
});
