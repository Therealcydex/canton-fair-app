import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Backend: 3000, web app: 3001, mobile app in the browser: 5173.
//
// `npm run dev:phone` (mode "phone") is for testing on a phone over the Wi-Fi: browsers only
// open the live camera (QR scanner, D34) on https. The dev server then uses a local certificate
// (accept the warning once on the phone) and passes /api and /uploads to the backend itself, so
// the app calls its own https address and no PC address is needed in .env.
export default defineConfig(({ mode }) => {
  const phone = mode === 'phone';
  // A VITE_ variable already in process.env wins over the .env files.
  if (phone) process.env.VITE_API_BASE_URL = '/api';
  const backend = process.env.VITE_DEV_API_TARGET || 'http://localhost:3000';
  return {
    plugins: phone ? [react(), basicSsl()] : [react()],
    server: {
      port: 5173,
      host: true,
      proxy: phone
        ? { '/api': { target: backend, changeOrigin: true }, '/uploads': { target: backend, changeOrigin: true } }
        : undefined,
    },
  };
});
