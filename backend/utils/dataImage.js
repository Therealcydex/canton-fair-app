// D61: images stored in the database as Base64 data URLs ("data:image/jpeg;base64,..."): product
// photos and contact avatars. The app resizes them before sending; the server checks the format,
// the real content (JPEG, PNG or WebP signature, not the type the client claims) and the size.
const { imageExtension } = require('./upload');

const PREFIX = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const MIME = { jpg: 'jpeg', png: 'png', webp: 'webp' };

// Returns { value } (the data URL, normalised) or { message } (French, for a 400).
function parseDataImage(raw, maxBytes, label) {
  if (typeof raw !== 'string' || !raw) return { message: `${label} : image attendue` };
  if (raw.length > Math.ceil((maxBytes * 4) / 3) + 40) {
    return { message: `${label} : image trop lourde (${Math.round(maxBytes / 1024)} Ko au maximum)` };
  }
  const m = PREFIX.exec(raw);
  if (!m) return { message: `${label} : image JPEG, PNG ou WebP en Base64 attendue` };
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > maxBytes) return { message: `${label} : image trop lourde (${Math.round(maxBytes / 1024)} Ko au maximum)` };
  const ext = imageExtension(buffer);
  if (!ext) return { message: `${label} : le contenu n'est pas une image JPEG, PNG ou WebP` };
  return { value: `data:image/${MIME[ext]};base64,${m[2]}` };
}

module.exports = { parseDataImage };
