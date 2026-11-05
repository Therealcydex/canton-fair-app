import axios from 'axios';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';

// D79: download through /api (JWT). A plain /uploads/ link fails when nginx only serves the React app.
export async function downloadCatalogFile(catalog, onError) {
  try {
    const res = await axios.get(`${API_BASE_URL}/suppliers/catalogs/${catalog.id}/file`, {
      responseType: 'blob',
    });
    const type = res.headers['content-type'] || '';
    if (type.includes('application/json')) {
      const text = await res.data.text();
      let message = 'Téléchargement impossible';
      try { message = JSON.parse(text).message || message; } catch { /* keep */ }
      onError?.(message);
      return;
    }
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = catalog.file_name || 'catalogue.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    onError?.(apiError(err, 'Erreur lors du téléchargement'));
  }
}
