import { useRef, useState } from 'react';
import axios from 'axios';
import { App, Button, Image, Popconfirm, Upload } from 'antd';
import { DeleteOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { ACCEPTED_IMAGES, toProductPhoto } from '../../utils/image';
import { readCatalogFile } from './CatalogsField';

export const MAX_SUPPLIER_IMAGES = 30;

// Adds or removes catalogues and photos on the fournisseur page itself (D75).
async function saveFiles(supplierId, body) {
  await axios.put(`${API_BASE_URL}/suppliers/${supplierId}`, body);
}

function useSaver(supplierId, onChanged) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const run = async (body, ok) => {
    setBusy(true);
    try {
      await saveFiles(supplierId, body);
      message.success(ok);
      onChanged();
    } catch (err) {
      message.error(err.response ? apiError(err, 'Erreur lors de l\'enregistrement') : err.message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, setBusy, run, message };
}

// Several files are chosen at once. beforeUpload runs once per file, in order.
function takeFiles(file, files, room, queue, warn) {
  const index = files.indexOf(file);
  if (index >= room) {
    if (index === room || (room <= 0 && index === 0)) warn();
    return null;
  }
  queue.current.push(file);
  if (queue.current.length < Math.min(files.length, room)) return null;
  const chosen = queue.current.splice(0);
  return chosen;
}

export function SupplierImages({ supplier, viewer, onChanged }) {
  const images = supplier.images || [];
  const { busy, setBusy, run, message } = useSaver(supplier.id, onChanged);
  const queue = useRef([]);

  const upload = async (files) => {
    setBusy(true);
    try {
      const photos = [];
      for (const file of files) {
        try {
          photos.push(await toProductPhoto(file));
        } catch (err) {
          message.error(err.message);
        }
      }
      if (!photos.length) return;
      await saveFiles(supplier.id, { images_add: photos });
      message.success(photos.length > 1 ? `${photos.length} images ajoutées` : 'Image ajoutée');
      onChanged();
    } catch (err) {
      message.error(err.response ? apiError(err, 'Erreur lors de l\'enregistrement') : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {images.length ? (
        <Image.PreviewGroup>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {images.map((img) => (
              <div key={img.id} className="position-relative">
                <Image src={img.thumb_data} preview={{ src: img.image_data }} alt=""
                  width={96} height={96} style={{ objectFit: 'cover', borderRadius: 8 }} />
                {!viewer && (
                  <Popconfirm title="Supprimer cette image ?" okText="Supprimer" cancelText="Annuler"
                    onConfirm={() => run({ images_remove: [img.id] }, 'Image supprimée')}>
                    <Button size="small" danger type="text" icon={<DeleteOutlined />} aria-label="Supprimer"
                      className="position-absolute" style={{ top: 2, right: 2, background: 'rgba(255,255,255,.9)' }}
                      onClick={(e) => e.stopPropagation()} />
                  </Popconfirm>
                )}
              </div>
            ))}
          </div>
        </Image.PreviewGroup>
      ) : <p className="text-secondary mb-3">Aucune image.</p>}
      {!viewer && (
        <Upload accept={ACCEPTED_IMAGES} multiple showUploadList={false} disabled={busy || images.length >= MAX_SUPPLIER_IMAGES}
          beforeUpload={(file, files) => {
            const chosen = takeFiles(file, files, MAX_SUPPLIER_IMAGES - images.length, queue,
              () => message.warning(`Un fournisseur a au plus ${MAX_SUPPLIER_IMAGES} images`));
            if (chosen) upload(chosen);
            return false;
          }}>
          <Button icon={<PlusOutlined />} loading={busy} disabled={images.length >= MAX_SUPPLIER_IMAGES}>
            Ajouter des images
          </Button>
        </Upload>
      )}
    </>
  );
}

export function SupplierCatalogs({ supplier, viewer, onChanged }) {
  const catalogs = supplier.catalogs || [];
  const { busy, setBusy, run, message } = useSaver(supplier.id, onChanged);
  const queue = useRef([]);

  const upload = async (files) => {
    setBusy(true);
    let saved = 0;
    let failed = null;
    try {
      for (const file of files) {
        try {
          const pdf = await readCatalogFile(file);
          await saveFiles(supplier.id, { catalogs_add: [pdf] });
          saved += 1;
        } catch (err) {
          failed = err.response ? apiError(err, 'Erreur lors de l\'ajout') : err.message;
          break;
        }
      }
      if (saved) onChanged();
      if (failed) message.error(failed);
      else if (saved) message.success(saved > 1 ? `${saved} catalogues ajoutés` : 'Catalogue ajouté');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {catalogs.length ? (
        <ul className="list-unstyled mb-3">
          {catalogs.map((file) => (
            <li key={file.id} className="d-flex align-items-center gap-2 mb-2">
              <a href={file.file_data} download={file.file_name} target="_blank" rel="noreferrer">
                <FilePdfOutlined className="me-2" />{file.file_name}
              </a>
              {!viewer && (
                <Popconfirm title="Supprimer ce catalogue ?" okText="Supprimer" cancelText="Annuler"
                  onConfirm={() => run({ catalogs_remove: [file.id] }, 'Catalogue supprimé')}>
                  <Button size="small" danger type="text" icon={<DeleteOutlined />} aria-label="Supprimer" />
                </Popconfirm>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="text-secondary mb-3">Aucun catalogue.</p>}
      {!viewer && (
        <Upload accept="application/pdf,.pdf" multiple showUploadList={false} disabled={busy}
          beforeUpload={(file, files) => {
            const chosen = takeFiles(file, files, files.length, queue, () => {});
            if (chosen) upload(chosen);
            return false;
          }}>
          <Button icon={<PlusOutlined />} loading={busy}>
            Ajouter des catalogues
          </Button>
        </Upload>
      )}
    </>
  );
}
