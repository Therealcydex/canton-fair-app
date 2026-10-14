import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

test('shows the login page when logged out', () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByText('Sourcing — Connexion')).toBeInTheDocument();
  expect(screen.getByText('Se connecter')).toBeInTheDocument();
});

test('the login page links to the sign-up page', async () => {
  localStorage.clear();
  render(<App />);
  fireEvent.click(screen.getByText('Créer un compte'));
  expect(await screen.findByText('Sourcing — Créer un compte')).toBeInTheDocument();
  expect(screen.getByText('Créer mon compte')).toBeInTheDocument();
});
