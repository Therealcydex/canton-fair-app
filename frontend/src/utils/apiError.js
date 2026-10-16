// The server's French message when there is one, never a bare "Erreur".
export const apiError = (err, fallback) =>
  err?.response?.data?.message ||
  (err?.response ? fallback : 'Serveur injoignable, vérifiez votre connexion');
