// Product photo uploads (D17). Files are read in memory, checked by their content (not by the
// name or the type the browser claims), then written under uploads/<folder>/ with a random name.
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { fail } = require('./http');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB per photo
const MAX_FILES_PER_REQUEST = 10;

// Signature of each accepted image type -> extension.
const SIGNATURES = [
  { ext: 'jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

const imageExtension = (buffer) => SIGNATURES.find((s) => s.test(buffer))?.ext || null;

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES_PER_REQUEST },
}).array('images', MAX_FILES_PER_REQUEST);

// Express middleware: parses the "images" field and answers 400/413 in the usual shape on a
// multer error (too big, too many files, wrong field name).
const parseImages = (req, res, next) => {
  parser(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return fail(res, 413, `Photo trop volumineuse (${MAX_FILE_SIZE / 1024 / 1024} Mo au maximum)`);
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return fail(res, 400, `Envoyez au plus ${MAX_FILES_PER_REQUEST} photos dans le champ « images »`);
    }
    return fail(res, 400, "Envoi des photos impossible");
  });
};

// Writes the buffers; returns their public URLs ("/uploads/<folder>/<name>.<ext>").
async function saveImages(files, folder) {
  const dir = path.join(UPLOAD_ROOT, folder);
  await fs.mkdir(dir, { recursive: true });
  const urls = [];
  for (const f of files) {
    const name = `${crypto.randomBytes(16).toString('hex')}.${imageExtension(f.buffer)}`;
    await fs.writeFile(path.join(dir, name), f.buffer);
    urls.push(`/uploads/${folder}/${name}`);
  }
  return urls;
}

// Deletes files by their public URL; a missing file is not an error. Only paths inside
// uploads/ are touched.
async function deleteImages(urls) {
  for (const url of urls) {
    const file = path.resolve(UPLOAD_ROOT, url.replace(/^\/uploads\//, ''));
    if (!file.startsWith(UPLOAD_ROOT + path.sep)) continue;
    await fs.unlink(file).catch((e) => {
      if (e.code !== 'ENOENT') console.warn('[upload] could not delete', file, e.message);
    });
  }
}

module.exports = { UPLOAD_ROOT, parseImages, imageExtension, saveImages, deleteImages, MAX_FILES_PER_REQUEST };
