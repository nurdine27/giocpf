'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import { Icon } from '../icon';
import { Spinner } from './ui';
import { useToast } from './feedback';
import { errorMessage, uploadImages, type UploadFolder } from '@/lib/api';
import { IMAGE_ACCEPT, MAX_IMAGE_MB } from '@/lib/constants';

export type ImageValue = { url: string; publicId?: string | null; alt?: string; id?: string };

function validFiles(list: FileList | File[], onReject: (message: string) => void) {
  const files = Array.from(list);
  const ok = files.filter(
    (f) => IMAGE_ACCEPT.split(',').includes(f.type) && f.size <= MAX_IMAGE_MB * 1024 * 1024,
  );
  if (ok.length < files.length)
    onReject(
      `Alguns ficheiros foram ignorados. Use JPEG, PNG, WEBP ou GIF até ${MAX_IMAGE_MB} MB.`,
    );
  return ok;
}

function useDropzone(onFiles: (files: File[]) => void) {
  const [dragging, setDragging] = useState(false);
  return {
    dragging,
    props: {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(true);
      },
      onDragLeave: () => setDragging(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        onFiles(Array.from(e.dataTransfer.files));
      },
    },
  };
}

/** One image (cover, avatar, logo). Uploads immediately and reports the hosted URL. */
export function ImageUpload({
  value,
  onChange,
  folder,
  label = 'Carregar imagem',
  shape = 'wide',
}: {
  value: ImageValue | null;
  onChange: (value: ImageValue | null) => void;
  folder: UploadFolder;
  label?: string;
  shape?: 'wide' | 'square' | 'round';
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(files: File[]) {
    const [file] = validFiles(files, toast.warning);
    if (!file) return;
    setBusy(true);
    try {
      const [uploaded] = await uploadImages([file], folder);
      onChange({ url: uploaded.url, publicId: uploaded.publicId, alt: uploaded.name });
      toast.success('Imagem carregada.');
    } catch (e) {
      toast.error(errorMessage(e), 'Falha no upload');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  const drop = useDropzone(handle);

  return (
    <div
      className={`uploader uploader-${shape} ${drop.dragging ? 'is-dragging' : ''}`}
      {...drop.props}
    >
      {value?.url ? (
        <div className="uploader-preview">
          <Image src={value.url} alt="" fill sizes="400px" />
          <div className="uploader-overlay">
            <button
              type="button"
              className="btn btn-light btn-sm"
              onClick={() => input.current?.click()}
            >
              <Icon name="swap_horiz" /> Substituir
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onChange(null)}>
              <Icon name="delete" /> Remover
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="uploader-empty" onClick={() => input.current?.click()}>
          <Icon name="add_photo_alternate" />
          <strong>{label}</strong>
          <small>Arraste para aqui ou clique · até {MAX_IMAGE_MB} MB</small>
        </button>
      )}
      {busy && (
        <div className="uploader-busy">
          <Spinner /> A enviar…
        </div>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept={IMAGE_ACCEPT}
        onChange={(e) => e.target.files && handle(Array.from(e.target.files))}
      />
    </div>
  );
}

/** Several photos. `onAdd` receives newly uploaded images; `onRemove` handles deletion (with confirm upstream). */
export function GalleryUpload({
  photos,
  onAdd,
  onRemove,
  folder = 'conteudos',
  max = 100,
}: {
  photos: ImageValue[];
  onAdd: (images: ImageValue[]) => void | Promise<void>;
  onRemove: (photo: ImageValue, index: number) => void;
  folder?: UploadFolder;
  max?: number;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);

  async function handle(files: File[]) {
    let list = validFiles(files, toast.warning);
    if (photos.length + list.length > max) {
      toast.warning(`Pode adicionar no máximo ${max} fotografias.`);
      list = list.slice(0, Math.max(0, max - photos.length));
    }
    if (!list.length) return;
    setPending(list.length);
    try {
      const uploaded: ImageValue[] = [];
      for (let i = 0; i < list.length; i += 10) {
        const batch = await uploadImages(list.slice(i, i + 10), folder);
        uploaded.push(...batch.map((u) => ({ url: u.url, publicId: u.publicId, alt: u.name })));
      }
      await onAdd(uploaded);
      toast.success(
        `${uploaded.length} ${uploaded.length === 1 ? 'fotografia carregada' : 'fotografias carregadas'}.`,
      );
    } catch (e) {
      toast.error(errorMessage(e), 'Falha no upload');
    } finally {
      setPending(0);
      if (input.current) input.current.value = '';
    }
  }
  const drop = useDropzone(handle);

  return (
    <div className="gallery-upload">
      <div className="gallery-grid-admin">
        {photos.map((p, i) => (
          <figure key={p.id ?? p.url}>
            <Image src={p.url} alt={p.alt ?? ''} fill sizes="160px" />
            <button
              type="button"
              className="gallery-remove"
              aria-label="Remover fotografia"
              onClick={() => onRemove(p, i)}
            >
              <Icon name="close" />
            </button>
          </figure>
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <figure key={`pending-${i}`} className="is-pending">
            <Spinner />
          </figure>
        ))}
        <button
          type="button"
          className={`gallery-add ${drop.dragging ? 'is-dragging' : ''}`}
          onClick={() => input.current?.click()}
          disabled={pending > 0}
          {...drop.props}
        >
          <Icon name="add_a_photo" />
          <span>Adicionar fotos</span>
        </button>
      </div>
      <small className="form-hint">
        {photos.length} de {max} fotografias · JPEG, PNG, WEBP ou GIF até {MAX_IMAGE_MB} MB cada.
      </small>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept={IMAGE_ACCEPT}
        onChange={(e) => e.target.files && handle(Array.from(e.target.files))}
      />
    </div>
  );
}
