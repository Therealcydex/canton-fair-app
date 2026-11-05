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
// D77: catalogues are written to disk (not Base64). 200 Mo covers a large fair PDF without
// loading it as text in the browser or in a JSON body.
const MAX_CATALOG_BYTES = 200 * 1024 * 1024;
const CATALOG_FOLDER = 'catalogs';

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

const catalogParser = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOAD_ROOT, CATALOG_FOLDER);
      fs.mkdir(dir, { recursive: true }).then(() => cb(null, dir)).catch(cb);
    },
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}.pdf`),
  }),
  limits: { fileSize: MAX_CATALOG_BYTES, files: 1 },
}).single('catalog');

// One PDF in the "catalog" field. Written under uploads/catalogs/ then checked (%PDF-).
const parseCatalog = (req, res, next) => {
  catalogParser(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return fail(res, 413, `Catalogue trop volumineux (${MAX_CATALOG_BYTES / 1024 / 1024} Mo au maximum)`);
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return fail(res, 400, 'Envoyez un seul PDF dans le champ « catalog »');
      }
      return fail(res, 400, "Envoi du catalogue impossible");
    }
    const file = req.file;
    if (!file) return fail(res, 400, 'Envoyez un PDF (champ « catalog »)');
    try {
      const fd = await fs.open(file.path, 'r');
      const buf = Buffer.alloc(5);
      await fd.read(buf, 0, 5, 0);
      await fd.close();
      if (buf.toString('latin1') !== '%PDF-') {
        await fs.unlink(file.path).catch(() => {});
        return fail(res, 400, 'Le contenu n\'est pas un PDF');
      }
    } catch (e) {
      await fs.unlink(file.path).catch(() => {});
      return fail(res, 400, "Envoi du catalogue impossible");
    }
    const rawName = (file.originalname || 'catalogue.pdf').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 200);
    req.catalog = {
      file_name: rawName.toLowerCase().endsWith('.pdf') ? rawName || 'catalogue.pdf' : `${rawName || 'catalogue'}.pdf`,
      file_url: `/uploads/${CATALOG_FOLDER}/${file.filename}`,
      path: file.path,
    };
    return next();
  });
};

module.exports = {
  UPLOAD_ROOT, parseImages, parseCatalog, imageExtension, saveImages, deleteImages,
  MAX_FILES_PER_REQUEST, MAX_CATALOG_BYTES, CATALOG_FOLDER,
};
