// The WeChat QR code of a contact (D33, D34). contacts.wechat_qr holds one of:
// - "/uploads/wechat/<file>": a photo of the QR code (older), shown as an image;
// - "http(s)://...": the content read by the scanner, from which a QR code is drawn;
// - any other text: an older typed WeChat id, or a scanned QR that holds no link: shown as text.
// Same rules as the web app (frontend/src/utils/qr.js).
import { useEffect, useState } from 'react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { fileUrl } from './config/api';

export const isQrPhoto = (value?: string | null) => !!value && value.startsWith('/uploads/');
export const isQrLink = (value?: string | null) => !!value && /^https?:\/\//i.test(value);
// WeChat QR codes point to wechat.com or weixin.qq.com; anything else gets a warning.
export const isWechatLink = (value?: string | null) => {
  if (!isQrLink(value)) return false;
  try {
    return /(^|\.)(wechat\.com|weixin\.qq\.com)$/i.test(new URL(value as string).hostname);
  } catch {
    return false;
  }
};

// The image to show for a value: the photo, a QR code drawn from the link, or null (text).
export function useQrImage(value?: string | null): string | null {
  const [drawn, setDrawn] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setDrawn(null);
    if (isQrLink(value)) {
      QRCode.toDataURL(value as string, { margin: 2, width: 512, errorCorrectionLevel: 'M' })
        .then((url) => alive && setDrawn(url))
        .catch(() => alive && setDrawn(null));
    }
    return () => { alive = false; };
  }, [value]);
  if (isQrPhoto(value)) return fileUrl(value) || null;
  return drawn;
}

// Reads a QR code from image pixels (a camera frame or a photo). Returns its text or null.
export function decodePixels(data: Uint8ClampedArray, width: number, height: number): string | null {
  const code = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  return code && code.data ? code.data : null;
}

// Reads a QR code from a photo file, scaled down so a 12-megapixel photo stays fast.
export async function decodeQrFromFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image'));
      i.src = url;
    });
    for (const max of [1200, 2000, 800]) {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      const found = decodePixels(ctx.getImageData(0, 0, w, h).data, w, h);
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
