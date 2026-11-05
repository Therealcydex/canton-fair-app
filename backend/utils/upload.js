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

const CATALOG_TMP = path.join(UPLOAD_ROOT, CATALOG_FOLDER, '.tmp');
const MAX_CHUNK_BYTES = 5 * 1024 * 1024; // each piece stays small so nginx does not cut the transfer
const UPLOAD_ID_RE = /^[a-f0-9-]{8,64}$/i;

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

const catalogChunkParser = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadId = String(req.body?.uploadId || '');
      if (!UPLOAD_ID_RE.test(uploadId)) return cb(new Error('UPLOAD_ID'));
      const dir = path.join(CATALOG_TMP, uploadId);
      fs.mkdir(dir, { recursive: true }).then(() => cb(null, dir)).catch(cb);
    },
    filename: (req, file, cb) => {
      const index = Number(req.body?.index);
      if (!Number.isInteger(index) || index < 0 || index > 500) return cb(new Error('INDEX'));
      cb(null, `${index}.part`);
    },
  }),
  limits: { fileSize: MAX_CHUNK_BYTES, files: 1 },
}).single('chunk');

function cleanCatalogName(name) {
  const rawName = (name || 'catalogue.pdf').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 200);
  return rawName.toLowerCase().endsWith('.pdf') ? rawName || 'catalogue.pdf' : `${rawName || 'catalogue'}.pdf`;
}

async function isPdfFile(filePath) {
  const fd = await fs.open(filePath, 'r');
  const buf = Buffer.alloc(5);
  await fd.read(buf, 0, 5, 0);
  await fd.close();
  return buf.toString('latin1') === '%PDF-';
}

async function removeDir(dir) {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

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
      if (!(await isPdfFile(file.path))) {
        await fs.unlink(file.path).catch(() => {});
        return fail(res, 400, 'Le contenu n\'est pas un PDF');
      }
    } catch (e) {
      await fs.unlink(file.path).catch(() => {});
      return fail(res, 400, "Envoi du catalogue impossible");
    }
    req.catalog = {
      file_name: cleanCatalogName(file.originalname),
      file_url: `/uploads/${CATALOG_FOLDER}/${file.filename}`,
      path: file.path,
    };
    return next();
  });
};

// D78: one piece of a large PDF (field « chunk »). Assembled when the last index arrives.
const parseCatalogChunk = (req, res, next) => {
  catalogChunkParser(req, res, async (err) => {
    if (err) {
      if (err.message === 'UPLOAD_ID' || err.message === 'INDEX') {
        return fail(res, 400, 'Identifiant d\'envoi invalide');
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return fail(res, 413, `Morceau trop volumineux (${MAX_CHUNK_BYTES / 1024 / 1024} Mo au maximum)`);
      }
      return fail(res, 400, "Envoi du catalogue impossible");
    }
    if (!req.file) return fail(res, 400, 'Envoyez un morceau (champ « chunk »)');
    const uploadId = String(req.body.uploadId || '');
    const index = Number(req.body.index);
    const total = Number(req.body.total);
    const fileName = cleanCatalogName(req.body.fileName);
    if (!UPLOAD_ID_RE.test(uploadId) || !Number.isInteger(index) || !Number.isInteger(total)
      || total < 1 || total > 500 || index < 0 || index >= total) {
      await fs.unlink(req.file.path).catch(() => {});
      return fail(res, 400, 'Paramètres d\'envoi invalides');
    }
    req.catalogChunk = { uploadId, index, total, fileName, path: req.file.path };
    return next();
  });
};

// When every .part is present, build the PDF under catalogs/ and remove the temp folder.
async function assembleCatalogChunks({ uploadId, total, fileName }) {
  const dir = path.join(CATALOG_TMP, uploadId);
  for (let i = 0; i < total; i++) {
    try {
      await fs.access(path.join(dir, `${i}.part`));
    } catch {
      return { pending: true };
    }
  }
  const finalName = `${crypto.randomBytes(16).toString('hex')}.pdf`;
  const finalPath = path.join(UPLOAD_ROOT, CATALOG_FOLDER, finalName);
  await fs.mkdir(path.join(UPLOAD_ROOT, CATALOG_FOLDER), { recursive: true });
  const out = await fs.open(finalPath, 'w');
  try {
    for (let i = 0; i < total; i++) {
      const part = await fs.readFile(path.join(dir, `${i}.part`));
      await out.write(part);
    }
  } finally {
    await out.close();
  }
  await removeDir(dir);
  if (!(await isPdfFile(finalPath))) {
    await fs.unlink(finalPath).catch(() => {});
    return { status: 400, message: 'Le contenu n\'est pas un PDF' };
  }
  const size = (await fs.stat(finalPath)).size;
  if (size > MAX_CATALOG_BYTES) {
    await fs.unlink(finalPath).catch(() => {});
    return { status: 413, message: `Catalogue trop volumineux (${MAX_CATALOG_BYTES / 1024 / 1024} Mo au maximum)` };
  }
  return {
    file_name: fileName,
    file_url: `/uploads/${CATALOG_FOLDER}/${finalName}`,
    path: finalPath,
  };
}

module.exports = {
  UPLOAD_ROOT, parseImages, parseCatalog, parseCatalogChunk, assembleCatalogChunks,
  imageExtension, saveImages, deleteImages,
  MAX_FILES_PER_REQUEST, MAX_CATALOG_BYTES, MAX_CHUNK_BYTES, CATALOG_FOLDER,
};
