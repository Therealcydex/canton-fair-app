import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tn.sourcing.app', // to confirm before publishing (D20)
  appName: 'Sourcing',
  webDir: 'dist',
  server: {
    // The API is reached over plain http on a local network during development. Set it to
    // 'https' (and remove cleartext) once the API has an https address.
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
