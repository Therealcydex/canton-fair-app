// D61: images are stored as Base64 in the database, so the app shrinks them before sending: a
// phone photo of several MB becomes a JPEG of a few hundred KB. The server checks them again.
export const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp';

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new window.Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`« ${file.name} » n'est pas une image lisible`)); };
  img.src = url;
});

// The image at most maxSide pixels on its longest side, as a JPEG data URL. A white background
// replaces the transparency of a PNG (JPEG has none).
const draw = (img, maxSide, quality) => {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
};

// One image file -> its data URL, at most maxSide pixels.
export async function toDataImage(file, maxSide = 1280, quality = 0.82) {
  return draw(await loadImage(file), maxSide, quality);
}

// A product photo: { data } (1280 px) and { thumb } (200 px, for the lists).
export async function toProductPhoto(file) {
  const img = await loadImage(file);
  return { data: draw(img, 1280, 0.82), thumb: draw(img, 200, 0.75) };
}
