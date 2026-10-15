import { useState } from 'react';
import { parseCard, type CardFields } from '../cardParser';
import { readCardText } from '../ocr';
import { ErrorBox } from './ui';

// "Scanner une carte de visite": takes a photo of the card, reads it on the phone (D37) and hands
// the fields found to the form, which the buyer checks before saving.
export default function CardScanButton({ onRead }: { onRead: (fields: CardFields) => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const scan = async (file?: File) => {
    if (!file) return;
    setError(null);
    setNotice(null);
    setProgress(0);
    try {
      const text = await readCardText(file, setProgress);
      const fields = parseCard(text);
      const found = Object.values(fields).filter(Boolean).length;
      if (!found) {
        setError('Aucun texte lisible sur cette photo. Reprenez la carte bien à plat, nette et en entier.');
      } else {
        onRead(fields);
        setNotice(`${found} champ(s) rempli(s) depuis la carte : vérifiez-les avant d'enregistrer.`);
      }
    } catch {
      setError("La carte n'a pas pu être lue (connexion ou photo). Réessayez.");
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;
  return (
    <div className="space-y-2">
      <label className={`flex min-h-[44px] w-full items-center justify-center rounded-lg border border-blue-600 px-4 font-medium ${busy ? 'text-slate-400' : 'text-blue-700 active:bg-blue-50'}`}>
        {busy ? `Lecture de la carte… ${Math.round((progress || 0) * 100)} %` : 'Scanner une carte de visite'}
        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy}
          onChange={(e) => { scan(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      <ErrorBox message={error} />
      {notice && <p role="status" className="text-xs text-slate-600">{notice}</p>}
    </div>
  );
}
