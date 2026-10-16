import { useState } from 'react';
import { Alert } from 'antd';
import { IdcardOutlined } from '@ant-design/icons';
import { parseCard } from '../utils/cardParser';
import { readCardText } from '../utils/ocr';

// "Scanner une carte de visite": a photo of the card (the phone's camera, or a picture on a
// computer), read in the browser (D37). The fields found go to `onRead`; the buyer checks them
// before saving, and the server validates them as usual.
export default function CardScanButton({ onRead }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const scan = async (file) => {
    if (!file) return;
    setError(null);
    setNotice(null);
    setProgress(0);
    try {
      const fields = parseCard(await readCardText(file, setProgress));
      const found = Object.values(fields).filter(Boolean).length;
      if (!found) {
        setError('Aucun texte lisible sur cette photo. Reprenez la carte bien à plat, nette et en entier.');
      } else {
        onRead(fields);
        setNotice(`${found} champ${found > 1 ? 's' : ''} rempli${found > 1 ? 's' : ''} depuis la carte : vérifiez-les avant d'enregistrer.`);
      }
    } catch {
      setError("La carte n'a pas pu être lue (connexion ou photo). Réessayez.");
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;
  return (
    <div className="mb-3 d-grid gap-2">
      {/* A label around the file input (it opens the camera on a phone), styled as a large button. */}
      <label className={`sc-file-btn card-scan ${busy ? 'is-busy' : ''}`}>
        <IdcardOutlined />
        {busy ? `Lecture de la carte… ${Math.round(progress * 100)} %` : 'Scanner une carte de visite'}
        <input type="file" accept="image/*" capture="environment" hidden disabled={busy}
          onChange={(e) => { scan(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {error && <Alert type="error" showIcon message={error} />}
      {notice && <Alert type="info" showIcon message={notice} />}
    </div>
  );
}
