import { useCallback, useEffect, useRef, useState } from 'react';
import { decodePixels, decodeQrFromFile, isQrLink, isWechatLink, useQrImage } from '../qr';
import { Button, ErrorBox } from './ui';

const SCAN_EVERY_MS = 150;

// Why the live camera cannot open, in French.
function cameraError(e: unknown): string {
  if (!window.isSecureContext) return 'La caméra en direct demande une page https (voir mobile/README.md).';
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return "L'accès à la caméra a été refusé.";
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Aucune caméra trouvée.';
  return "La caméra n'a pas pu s'ouvrir.";
}

// Full-screen QR code scanner (D34). It reads the QR with the back camera and shows what it
// found; the caller saves it. When the live camera is unavailable (http page, permission refused),
// a photo of the QR code is read instead.
export default function QrScanner({ onSave, onClose }: { onSave: (content: string) => Promise<void>; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [cameraProblem, setCameraProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0); // "Scanner à nouveau" restarts the camera
  const preview = useQrImage(result);

  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    if (result) return undefined;
    let alive = true;
    let timer: number | undefined;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const scan = () => {
      const v = video.current;
      if (!alive || !v || !ctx) return;
      if (v.readyState >= 2 && v.videoWidth) {
        const scale = Math.min(1, 800 / Math.max(v.videoWidth, v.videoHeight));
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const found = decodePixels(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (found) {
          stopCamera();
          setResult(found);
          return;
        }
      }
      timer = window.setTimeout(scan, SCAN_EVERY_MS);
    };

    (async () => {
      setCameraProblem(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => undefined);
        }
        scan();
      } catch (e) {
        if (alive) setCameraProblem(cameraError(e));
      }
    })();

    return () => {
      alive = false;
      window.clearTimeout(timer);
      stopCamera();
    };
  }, [result, attempt, stopCamera]);

  const readPhoto = async (file?: File) => {
    if (!file) return;
    setError(null);
    const found = await decodeQrFromFile(file);
    if (found) setResult(found);
    else setError('Aucun QR code lisible sur cette photo. Reprenez-la plus près, bien à plat et nette.');
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(result);
    } catch (e) {
      setError((e as Error).message); // the server's message; the result stays to try again
    } finally {
      setSaving(false);
    }
  };

  const again = () => {
    setResult(null);
    setError(null);
    setAttempt((n) => n + 1);
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black text-white">
      <header className="flex items-center justify-between px-3 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <h2 className="text-lg font-semibold">Scanner le QR WeChat</h2>
        <button type="button" onClick={onClose} className="rounded px-3 py-1 text-2xl leading-none" aria-label="Fermer">✕</button>
      </header>

      {!result && (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden p-4">
          {!cameraProblem && (
            <>
              <video ref={video} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
              <div className="relative h-64 w-64 rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              <p className="relative text-center text-sm">Placez le QR code dans le cadre</p>
            </>
          )}
          {cameraProblem && <div className="w-full max-w-sm text-slate-900"><ErrorBox message={cameraProblem} /></div>}
          <div className="relative w-full max-w-sm space-y-2 text-slate-900">
            <ErrorBox message={error} />
            <label className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-white px-4 font-medium active:bg-slate-100">
              Prendre une photo du QR à la place
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { readPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
        </div>
      )}

      {result && (
        <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto bg-slate-50 p-4 text-slate-900">
          {preview && <img src={preview} alt="QR code lu" className="h-56 w-56 rounded-lg bg-white object-contain" />}
          <p className="w-full max-w-sm break-all rounded-lg bg-white p-3 text-sm">{result}</p>
          {!isWechatLink(result) && (
            <div role="status" className="w-full max-w-sm rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {isQrLink(result)
                ? "Ce lien n'est pas un lien WeChat. Vérifiez que c'est le bon QR code."
                : "Ce QR code ne contient pas de lien : il sera enregistré comme texte."}
            </div>
          )}
          <div className="w-full max-w-sm"><ErrorBox message={error} /></div>
          <div className="grid w-full max-w-sm gap-2">
            <Button disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
            <Button variant="secondary" disabled={saving} onClick={again}>Scanner à nouveau</Button>
            <Button variant="secondary" disabled={saving} onClick={onClose}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}
