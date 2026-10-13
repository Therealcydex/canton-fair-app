import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the home page', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Sourcing' })).toBeInTheDocument();
});
