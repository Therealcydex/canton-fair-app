// D75: a catalogue is a PDF stored as a data URL ("data:application/pdf;base64,...").
// The signature is checked, not the type the client claims.
const { clean } = require('./http');

const PREFIX = /^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/;

function parseDataPdf(raw, name, maxBytes, label) {
  if (typeof raw !== 'string' || !raw) return { message: `${label} : PDF attendu` };
  if (raw.length > Math.ceil((maxBytes * 4) / 3) + 40) {
    return { message: `${label} : PDF trop lourd (${Math.round(maxBytes / (1024 * 1024))} Mo au maximum)` };
  }
  const m = PREFIX.exec(raw);
  if (!m) return { message: `${label} : PDF en Base64 attendu` };
  const buffer = Buffer.from(m[1], 'base64');
  if (buffer.length > maxBytes) {
    return { message: `${label} : PDF trop lourd (${Math.round(maxBytes / (1024 * 1024))} Mo au maximum)` };
  }
  if (buffer.slice(0, 5).toString('latin1') !== '%PDF-') {
    return { message: `${label} : le contenu n'est pas un PDF` };
  }
  const fileName = (clean(name) || 'catalogue.pdf').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 200);
  if (!fileName) return { message: `${label} : nom de fichier invalide` };
  return { value: `data:application/pdf;base64,${m[1]}`, name: fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf` };
}

module.exports = { parseDataPdf };
