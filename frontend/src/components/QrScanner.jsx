import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert, Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { decodePixels, decodeQrFromFile, isQrLink, isWechatLink, useQrImage } from '../utils/qr';

const SCAN_EVERY_MS = 150;

// Why the live camera cannot open, in French.
function cameraError(e) {
  if (!window.isSecureContext) return 'La caméra en direct demande une page https.';
  const name = e?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return "L'accès à la caméra a été refusé.";
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Aucune caméra trouvée.';
  return "La caméra n'a pas pu s'ouvrir.";
}

// Full-screen WeChat QR code scanner (D34). It reads the QR with the back camera and shows what it
// found; `onSave(content)` saves it (a throw shows its message and keeps the result to try again).
// When the live camera is unavailable (http page, permission refused, no camera), a photo or a
// screenshot of the QR code is read instead.
export default function QrScanner({ onSave, onClose, saveLabel = 'Enregistrer' }) {
  const video = useRef(null);
  const stream = useRef(null);
  const [result, setResult] = useState(null);
  const [cameraProblem, setCameraProblem] = useState(null);
  const [error, setError] = useState(null);
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
    let timer;
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

  const readPhoto = async (file) => {
    if (!file) return;
    setError(null);
    const found = await decodeQrFromFile(file);
    if (found) setResult(found);
    else setError('Aucun QR code lisible sur cette image. Reprenez la photo plus près, bien à plat et nette.');
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(result);
    } catch (e) {
      setError(e.message); // the server's message; the result stays to try again
    } finally {
      setSaving(false);
    }
  };

  const again = () => {
    setResult(null);
    setError(null);
    setAttempt((n) => n + 1);
  };

  // In a portal, above the antd modals: opened from a form, it must stay outside that form.
  return createPortal(
    <div className="qr-scanner" role="dialog" aria-modal="true" aria-label="Scanner le QR WeChat">
      <header className="qr-scanner-head">
        <h2 className="h6 m-0">Scanner le QR WeChat</h2>
        <button type="button" className="qr-scanner-close" onClick={onClose} aria-label="Fermer"><CloseOutlined /></button>
      </header>

      {!result && (
        <div className="qr-scanner-live">
          {!cameraProblem && (
            <>
              <video ref={video} className="qr-scanner-video" playsInline muted />
              <div className="qr-scanner-frame" />
              <p className="qr-scanner-hint">Placez le QR code dans le cadre</p>
            </>
          )}
          <div className="qr-scanner-actions">
            {cameraProblem && <Alert type="warning" showIcon message={cameraProblem} />}
            {error && <Alert type="error" showIcon message={error} />}
            <label className="ant-btn ant-btn-default ant-btn-lg w-100 qr-scanner-photo">
              {cameraProblem ? 'Choisir une photo du QR code' : 'Prendre une photo du QR à la place'}
              <input type="file" accept="image/*" capture="environment" hidden
                onChange={(e) => { readPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
        </div>
      )}

      {result && (
        <div className="qr-scanner-result">
          {preview && <img src={preview} alt="QR code lu" className="qr-scanner-preview" />}
          <p className="qr-scanner-text">{result}</p>
          {!isWechatLink(result) && (
            <Alert type="warning" showIcon className="w-100"
              message={isQrLink(result)
                ? "Ce lien n'est pas un lien WeChat. Vérifiez que c'est le bon QR code."
                : 'Ce QR code ne contient pas de lien : il sera enregistré comme texte.'} />
          )}
          {error && <Alert type="error" showIcon message={error} className="w-100" />}
          <Button type="primary" size="large" block loading={saving} onClick={save}>{saveLabel}</Button>
          <Button size="large" block disabled={saving} onClick={again}>Scanner à nouveau</Button>
          <Button size="large" block disabled={saving} onClick={onClose}>Annuler</Button>
        </div>
      )}
    </div>,
    document.body,
  );
}
