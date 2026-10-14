import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Backend: 3000, web app: 3001, mobile app in the browser: 5173.
  server: { port: 5173, host: true },
});
