// Reads the text of a business card photo on the phone (tesseract.js, English, D37). The reader's
// files come from the app itself (public/ocr/, scripts/copy-ocr.cjs), never from a CDN. The
// library is loaded on the first card only, and its worker is kept for the next cards.
import type { Worker } from 'tesseract.js';

let worker: Promise<Worker> | null = null;
let report: (progress: number) => void = () => undefined;

function getWorker(): Promise<Worker> {
  if (!worker) {
    const base = new URL('./ocr/', document.baseURI).href;
    worker = import('tesseract.js')
      .then(({ createWorker, OEM }) => createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: `${base}worker.min.js`,
        corePath: base,
        langPath: base.replace(/\/$/, ''),
        gzip: true,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') report(m.progress);
        },
      }))
      .catch((e) => {
        worker = null; // try again on the next card
        throw e;
      });
  }
  return worker;
}

// A phone photo is 12 megapixels: a card reads as well, and much faster, at 1600 px.
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Cette photo n'a pas pu être ouverte"));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Cette photo n'a pas pu être ouverte");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The text of the card, line by line. `onProgress` gets 0 to 1 while the text is read (the first
// card also downloads the reader, about 7 MB, once).
export async function readCardText(file: File, onProgress: (progress: number) => void = () => undefined): Promise<string> {
  report = onProgress;
  const [w, canvas] = await Promise.all([getWorker(), prepare(file)]);
  const { data } = await w.recognize(canvas);
  return data.text || '';
}
