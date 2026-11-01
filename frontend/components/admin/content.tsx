'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Icon } from '../icon';
import { useAdmin } from './admin-layout';
import { useConfirm, useToast } from './feedback';
import { GalleryUpload, ImageUpload, type ImageValue } from './image-upload';
import {
  ActionMenu,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  Panel,
  SearchField,
  Skeleton,
  StatusBadge,
  Switch,
  Tabs,
  useResource,
  CardList,
  ListCard,
} from './ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { DRAFT, EVENT_STATUS, PUBLISHED, type Permission } from '@/lib/constants';
import { formatDate, formatDateTime, toLocalInput } from '@/lib/format';

type Kind = 'news' | 'events' | 'albums';
type Photo = { id: string; url: string; publicId: string | null; alt: string };
type Item = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  featured?: boolean;
  coverUrl: string | null;
  coverPublicId: string | null;
  updatedAt: string;
  subtitle?: string;
  summary?: string;
  content?: string;
  description?: string;
  location?: string;
  startsAt?: string;
  endsAt?: string | null;
  status?: string;
  categoryId?: string | null;
  category?: { name: string } | null;
  newsId?: string | null;
  eventId?: string | null;
  author?: { email: string; displayName: string };
  _count?: { photos: number };
  photos?: Photo[];
};
type Category = { id: string; name: string; _count?: { news: number } };
type ContentData = { news: Item[]; events: Item[]; albums: Item[]; categories: Category[] };

const KINDS: Record<
  Kind,
  {
    label: string;
    singular: string;
    newLabel: string;
    icon: string;
    permission: Permission;
    path: string;
  }
> = {
  news: {
    label: 'Notícias',
    singular: 'notícia',
    newLabel: 'Nova notícia',
    icon: 'article',
    permission: 'news.manage',
    path: '/noticias',
  },
  events: {
    label: 'Eventos',
    singular: 'evento',
    newLabel: 'Novo evento',
    icon: 'event',
    permission: 'events.manage',
    path: '/eventos',
  },
  albums: {
    label: 'Galeria',
    singular: 'álbum',
    newLabel: 'Novo álbum',
    icon: 'photo_library',
    permission: 'gallery.manage',
    path: '/galeria',
  },
};

export function ContentAdmin() {
  const params = useSearchParams();
  const { can } = useAdmin();
  const toast = useToast();
  const confirm = useConfirm();
  const allowed = (Object.keys(KINDS) as Kind[]).filter((k) => can(KINDS[k].permission));
  const initial = params.get('tab') as Kind | null;
  const [tab, setTab] = useState<Kind>(initial && allowed.includes(initial) ? initial : allowed[0]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const { data, setData, error, loading, reload } = useResource(
    () => apiFetch<ContentData>('/admin/content'),
    [],
  );

  const rows = useMemo(
    () =>
      (data?.[tab] ?? []).filter(
        (i) =>
          i.title.toLowerCase().includes(q.toLowerCase()) &&
          (filter === 'all' || (filter === 'published') === i.published),
      ),
    [data, tab, q, filter],
  );
  const meta = KINDS[tab];

  async function togglePublished(item: Item) {
    const next = !item.published;
    const ok = await confirm({
      title: next ? `Publicar ${meta.singular}?` : `Despublicar ${meta.singular}?`,
      message: next ? (
        <>«{item.title}» ficará visível para todos no site.</>
      ) : (
        <>«{item.title}» deixará de estar visível no site.</>
      ),
      confirmLabel: next ? 'Publicar' : 'Despublicar',
      tone: next ? 'primary' : 'danger',
      icon: next ? 'public' : 'public_off',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/content/${tab}/${item.id}`, {
        method: 'PATCH',
        body: { published: next },
      });
      setData(
        (d) =>
          d && {
            ...d,
            [tab]: d[tab].map((x) => (x.id === item.id ? { ...x, published: next } : x)),
          },
      );
      toast.success(next ? 'Publicado no site.' : 'Passou a rascunho.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function remove(item: Item) {
    const ok = await confirm({
      title: `Eliminar ${meta.singular}?`,
      message: (
        <>
          «{item.title}» e todas as suas fotografias serão eliminados permanentemente. Esta acção
          não pode ser anulada.
        </>
      ),
      confirmLabel: 'Eliminar',
      icon: 'delete_forever',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/content/${tab}/${item.id}`, { method: 'DELETE' });
      setData((d) => d && { ...d, [tab]: d[tab].filter((x) => x.id !== item.id) });
      toast.success('Conteúdo eliminado.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (!allowed.length) return null;

  return (
    <>
      <PageHeader
        title="Conteúdos"
        description="Notícias, eventos e álbuns publicados no site da instituição."
        actions={
          <>
            {tab === 'news' && (
              <button className="btn btn-ghost" onClick={() => setCategoriesOpen(true)}>
                <Icon name="sell" /> Categorias
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              <Icon name="add" /> {meta.newLabel}
            </button>
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          setQ('');
        }}
        items={allowed.map((k) => ({
          value: k,
          label: KINDS[k].label,
          icon: KINDS[k].icon,
          count: data?.[k].length,
        }))}
      />
      <Panel padded={false}>
        <div className="toolbar">
          <Tabs
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'all', label: 'Todos' },
              { value: 'published', label: 'Publicados' },
              { value: 'draft', label: 'Rascunhos' },
            ]}
          />
          <SearchField
            value={q}
            onChange={setQ}
            placeholder={`Pesquisar ${meta.label.toLowerCase()}`}
          />
        </div>
        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data && <Skeleton rows={5} height={64} />}
        {data && rows.length === 0 && (
          <EmptyState
            icon={meta.icon}
            title={`Sem ${meta.label.toLowerCase()} para mostrar`}
            description="Crie o primeiro conteúdo ou ajuste os filtros."
            action={
              <button className="btn btn-primary" onClick={() => setEditing('new')}>
                <Icon name="add" /> Criar
              </button>
            }
          />
        )}
        {rows.length > 0 && (
          <>
            <div className="table-wrap only-desktop">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th className="hide-sm">{tab === 'events' ? 'Data' : 'Actualizado'}</th>
                    <th>Estado</th>
                    <th className="center hide-sm">Publicado</th>
                    <th aria-label="Acções" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="cell-media">
                          <span className="thumb thumb-wide">
                            {item.coverUrl ? (
                              <Image src={item.coverUrl} alt="" fill sizes="80px" />
                            ) : (
                              <Icon name={meta.icon} />
                            )}
                          </span>
                          <span>
                            <button
                              type="button"
                              className="cell-title link-button"
                              onClick={() => setEditing(item)}
                            >
                              {item.featured && <Icon name="star" className="featured-star" />}
                              {item.title}
                            </button>
                            <small className="cell-sub">
                              {[
                                item.category?.name,
                                item.location,
                                `${item._count?.photos ?? 0} fotos`,
                                item.author?.displayName || item.author?.email,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td className="hide-sm">
                        {tab === 'events'
                          ? formatDateTime(item.startsAt)
                          : formatDate(item.updatedAt)}
                      </td>
                      <td>
                        {tab === 'events' && item.status ? (
                          <StatusBadge meta={EVENT_STATUS[item.status]} />
                        ) : (
                          <StatusBadge meta={item.published ? PUBLISHED : DRAFT} />
                        )}
                      </td>
                      <td className="center hide-sm">
                        <Switch
                          checked={item.published}
                          label={`Publicar ${item.title}`}
                          onChange={() => togglePublished(item)}
                        />
                      </td>
                      <td className="right">
                        <ActionMenu
                          label={item.title}
                          actions={[
                            { label: 'Editar', icon: 'edit', onSelect: () => setEditing(item) },
                            {
                              label: 'Ver no site',
                              icon: 'open_in_new',
                              hidden: !item.published,
                              onSelect: () => window.open(`${meta.path}/${item.slug}`, '_blank'),
                            },
                            {
                              label: item.published ? 'Despublicar' : 'Publicar',
                              icon: item.published ? 'public_off' : 'public',
                              onSelect: () => togglePublished(item),
                            },
                            {
                              label: 'Eliminar',
                              icon: 'delete',
                              danger: true,
                              onSelect: () => remove(item),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardList>
              {rows.map((item) => (
                <ListCard
                  key={item.id}
                  onOpen={() => setEditing(item)}
                  media={
                    <span className="thumb thumb-wide">
                      {item.coverUrl ? (
                        <Image src={item.coverUrl} alt="" fill sizes="80px" />
                      ) : (
                        <Icon name={meta.icon} />
                      )}
                    </span>
                  }
                  title={item.title}
                  subtitle={[
                    tab === 'events' ? formatDateTime(item.startsAt) : formatDate(item.updatedAt),
                    item.category?.name,
                    `${item._count?.photos ?? 0} fotos`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  meta={
                    <>
                      <StatusBadge meta={item.published ? PUBLISHED : DRAFT} />
                      {tab === 'events' && item.status && (
                        <StatusBadge meta={EVENT_STATUS[item.status]} />
                      )}
                      {item.featured && (
                        <span className="badge tone-warning">
                          <Icon name="star" /> Destaque
                        </span>
                      )}
                    </>
                  }
                  actions={[
                    { label: 'Editar', icon: 'edit', onSelect: () => setEditing(item) },
                    {
                      label: item.published ? 'Despublicar' : 'Publicar',
                      icon: item.published ? 'public_off' : 'public',
                      onSelect: () => togglePublished(item),
                    },
                    {
                      label: 'Ver no site',
                      icon: 'open_in_new',
                      hidden: !item.published,
                      onSelect: () => window.open(`${meta.path}/${item.slug}`, '_blank'),
                    },
                    {
                      label: 'Eliminar',
                      icon: 'delete',
                      danger: true,
                      onSelect: () => remove(item),
                    },
                  ]}
                />
              ))}
            </CardList>
          </>
        )}
      </Panel>
      {editing && data && (
        <ContentEditor
          kind={tab}
          itemId={editing === 'new' ? null : editing.id}
          data={data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
      {categoriesOpen && data && (
        <CategoryManager
          categories={data.categories}
          onClose={() => setCategoriesOpen(false)}
          onChange={reload}
        />
      )}
    </>
  );
}

function ContentEditor({
  kind,
  itemId,
  data,
  onClose,
  onSaved,
}: {
  kind: Kind;
  itemId: string | null;
  data: ContentData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const meta = KINDS[kind];
  const detail = useResource(
    () => (itemId ? apiFetch<Item>(`/admin/content/${kind}/${itemId}`) : Promise.resolve(null)),
    [kind, itemId],
  );
  if (itemId && !detail.data)
    return (
      <Modal title={`Editar ${meta.singular}`} onClose={onClose} variant="drawer" size="lg">
        {detail.error ? (
          <ErrorState message={detail.error} onRetry={detail.reload} />
        ) : (
          <Skeleton rows={6} />
        )}
      </Modal>
    );
  return (
    <EditorForm
      key={itemId ?? 'new'}
      kind={kind}
      item={detail.data}
      data={data}
      onClose={onClose}
      onSaved={onSaved}
      toast={toast}
      confirm={confirm}
    />
  );
}

function EditorForm({
  kind,
  item,
  data,
  onClose,
  onSaved,
  toast,
  confirm,
}: {
  kind: Kind;
  item: Item | null;
  data: ContentData;
  onClose: () => void;
  onSaved: () => void;
  toast: ReturnType<typeof useToast>;
  confirm: ReturnType<typeof useConfirm>;
}) {
  const meta = KINDS[kind];
  const [busy, setBusy] = useState(false);
  const [cover, setCover] = useState<ImageValue | null>(
    item?.coverUrl ? { url: item.coverUrl, publicId: item.coverPublicId } : null,
  );
  const [photos, setPhotos] = useState<ImageValue[]>(item?.photos ?? []);
  const [form, setForm] = useState({
    title: item?.title ?? '',
    subtitle: item?.subtitle ?? '',
    summary: item?.summary ?? '',
    content: item?.content ?? '',
    description: item?.description ?? '',
    location: item?.location ?? '',
    startsAt: toLocalInput(item?.startsAt),
    endsAt: toLocalInput(item?.endsAt),
    status: item?.status ?? 'AGENDADO',
    categoryId: item?.categoryId ?? '',
    newsId: item?.newsId ?? '',
    eventId: item?.eventId ?? '',
    published: item?.published ?? false,
    featured: item?.featured ?? false,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function addPhotos(images: ImageValue[]) {
    if (!item) return setPhotos((p) => [...p, ...images]);
    const saved = await apiFetch<Photo[]>(`/admin/content/${kind}/${item.id}/photos`, {
      method: 'POST',
      body: {
        photos: images.map(({ url, publicId, alt }) => ({
          url,
          publicId: publicId ?? undefined,
          alt,
        })),
      },
    });
    setPhotos(saved);
  }

  async function removePhoto(photo: ImageValue, index: number) {
    if (!photo.id) return setPhotos((p) => p.filter((_, i) => i !== index));
    const ok = await confirm({
      title: 'Remover fotografia?',
      message: 'A fotografia será eliminada permanentemente do armazenamento.',
      confirmLabel: 'Remover',
      icon: 'hide_image',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/content/photos/${photo.id}`, { method: 'DELETE' });
      setPhotos((p) => p.filter((x) => x.id !== photo.id));
      toast.success('Fotografia removida.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const common = {
      title: form.title,
      published: form.published,
      coverUrl: cover?.url ?? '',
      coverPublicId: cover?.publicId ?? '',
    };
    const specific =
      kind === 'news'
        ? {
            subtitle: form.subtitle,
            summary: form.summary,
            content: form.content,
            categoryId: form.categoryId,
            featured: form.featured,
          }
        : kind === 'events'
          ? {
              description: form.description,
              location: form.location,
              status: form.status,
              featured: form.featured,
              startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
              endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : '',
            }
          : { description: form.description, newsId: form.newsId, eventId: form.eventId };
    const newPhotos = item
      ? undefined
      : photos.map(({ url, publicId, alt }) => ({ url, publicId: publicId ?? undefined, alt }));
    try {
      await apiFetch(item ? `/admin/content/${kind}/${item.id}` : `/admin/content/${kind}`, {
        method: item ? 'PATCH' : 'POST',
        body: { ...common, ...specific, photos: newPhotos },
      });
      toast.success(
        item
          ? 'Alterações guardadas.'
          : form.published
            ? 'Publicado no site.'
            : 'Guardado como rascunho.',
      );
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={item ? `Editar ${meta.singular}` : meta.newLabel}
      onClose={onClose}
      variant="drawer"
      size="lg"
      footer={
        <>
          <label className="switch-inline">
            <Switch
              checked={form.published}
              onChange={(v) => set('published', v)}
              label="Publicar"
            />
            {form.published ? 'Publicado' : 'Rascunho'}
          </label>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="content-form" className="btn btn-primary" disabled={busy}>
            <Icon name="save" /> {busy ? 'A guardar…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="content-form" className="form-grid-2" onSubmit={submit}>
        <Field label="Imagem de capa" full>
          <ImageUpload value={cover} onChange={setCover} folder="conteudos" label="Carregar capa" />
        </Field>
        <Field label="Título" required full>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
            minLength={3}
            maxLength={180}
          />
        </Field>

        {kind === 'news' && (
          <>
            <Field label="Subtítulo" full>
              <input
                value={form.subtitle}
                onChange={(e) => set('subtitle', e.target.value)}
                maxLength={300}
              />
            </Field>
            <Field label="Categoria">
              <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">Sem categoria</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Resumo" hint="Aparece nas listagens.">
              <input
                value={form.summary}
                onChange={(e) => set('summary', e.target.value)}
                maxLength={500}
              />
            </Field>
            <Field label="Conteúdo" required full hint="Separe parágrafos com uma linha em branco.">
              <textarea
                rows={10}
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                required
                maxLength={30000}
              />
            </Field>
          </>
        )}

        {kind === 'events' && (
          <>
            <Field label="Início" required>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
                required
              />
            </Field>
            <Field label="Fim">
              <input
                type="datetime-local"
                value={form.endsAt}
                min={form.startsAt}
                onChange={(e) => set('endsAt', e.target.value)}
              />
            </Field>
            <Field label="Local">
              <input
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                maxLength={500}
              />
            </Field>
            <Field label="Estado">
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(EVENT_STATUS).map(([v, m]) => (
                  <option key={v} value={v}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {kind !== 'news' && (
          <Field label="Descrição" full>
            <textarea
              rows={5}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={30000}
            />
          </Field>
        )}

        {kind === 'albums' && (
          <>
            <Field label="Notícia relacionada">
              <select value={form.newsId} onChange={(e) => set('newsId', e.target.value)}>
                <option value="">Nenhuma</option>
                {data.news.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Evento relacionado">
              <select value={form.eventId} onChange={(e) => set('eventId', e.target.value)}>
                <option value="">Nenhum</option>
                {data.events.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {kind !== 'albums' && (
          <label className="switch-inline is-full">
            <Switch checked={form.featured} onChange={(v) => set('featured', v)} label="Destacar" />
            Destacar na página inicial
          </label>
        )}

        <Field label={kind === 'albums' ? 'Fotografias do álbum' : 'Galeria de fotografias'} full>
          <GalleryUpload photos={photos} onAdd={addPhotos} onRemove={removePhoto} />
        </Field>
      </form>
    </Modal>
  );
}

function CategoryManager({
  categories,
  onClose,
  onChange,
}: {
  categories: Category[];
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/admin/content/categories', { method: 'POST', body: { name } });
      setName('');
      toast.success('Categoria criada.');
      await onChange();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Category) {
    const ok = await confirm({
      title: 'Eliminar categoria?',
      message: <>As notícias de «{c.name}» ficam sem categoria.</>,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/content/categories/${c.id}`, { method: 'DELETE' });
      toast.success('Categoria eliminada.');
      await onChange();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Modal title="Categorias de notícias" onClose={onClose} size="sm">
      <form className="inline-form" onSubmit={add}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nova categoria"
          required
          minLength={2}
          maxLength={60}
          aria-label="Nome da categoria"
        />
        <button className="btn btn-primary" disabled={busy}>
          <Icon name="add" /> Adicionar
        </button>
      </form>
      <ul className="simple-list">
        {categories.map((c) => (
          <li key={c.id}>
            <span>
              {c.name} <small>{c._count?.news ?? 0} notícias</small>
            </span>
            <button
              className="icon-btn is-danger"
              aria-label={`Eliminar ${c.name}`}
              onClick={() => remove(c)}
            >
              <Icon name="delete" />
            </button>
          </li>
        ))}
        {!categories.length && <li className="muted-text">Ainda não há categorias.</li>}
      </ul>
    </Modal>
  );
}
