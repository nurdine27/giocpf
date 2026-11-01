'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Icon } from '../icon';
import { useConfirm, useToast } from './feedback';
import { ImageUpload, type ImageValue } from './image-upload';
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
  Switch,
  Tabs,
  useResource,
  CardList,
  ListCard,
  StatusBadge,
} from './ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { DRAFT, ENROLLMENT_CLOSED, ENROLLMENT_OPEN, PUBLISHED } from '@/lib/constants';

export type Course = {
  id: string;
  name: string;
  area: string;
  description: string;
  duration: string | null;
  requirements: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  published: boolean;
  enrollmentOpen: boolean;
  _count?: { registrations: number };
};
type Area = { name: string; icon: string };

export function CourseAdmin() {
  const toast = useToast();
  const confirm = useConfirm();
  const courses = useResource(() => apiFetch<Course[]>('/admin/courses'), []);
  const areas = useResource(() => apiFetch<Area[]>('/admin/courses/areas'), []);
  const [area, setArea] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Course | 'new' | null>(null);

  const rows = useMemo(
    () =>
      (courses.data ?? []).filter(
        (c) => (!area || c.area === area) && c.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [courses.data, area, q],
  );

  async function toggle(course: Course, key: 'published' | 'enrollmentOpen') {
    const next = !course[key];
    if (key === 'published' && !next) {
      const ok = await confirm({
        title: 'Despublicar curso?',
        message: (
          <>
            O curso <strong>{course.name}</strong> deixa de aparecer no site e no formulário de
            inscrição.
          </>
        ),
        confirmLabel: 'Despublicar',
      });
      if (!ok) return;
    }
    courses.setData(
      (all) => all?.map((c) => (c.id === course.id ? { ...c, [key]: next } : c)) ?? null,
    );
    try {
      await apiFetch(`/admin/courses/${course.id}`, { method: 'PATCH', body: { [key]: next } });
      toast.success(
        key === 'published'
          ? next
            ? 'Curso publicado no site.'
            : 'Curso despublicado.'
          : next
            ? 'Inscrições abertas.'
            : 'Inscrições encerradas.',
      );
    } catch (e) {
      toast.error(errorMessage(e));
      void courses.reload();
    }
  }

  async function remove(course: Course) {
    const count = course._count?.registrations ?? 0;
    const ok = await confirm({
      title: 'Eliminar curso?',
      message: (
        <>
          <strong>{course.name}</strong> será removido permanentemente.
          {count > 0 && (
            <>
              {' '}
              As {count} inscrições associadas são mantidas, mas deixam de estar ligadas ao curso.
            </>
          )}
        </>
      ),
      confirmLabel: 'Eliminar',
      icon: 'delete_forever',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/courses/${course.id}`, { method: 'DELETE' });
      courses.setData((all) => all?.filter((c) => c.id !== course.id) ?? null);
      toast.success('Curso eliminado.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const counts = (name: string) =>
    (courses.data ?? []).filter((c) => !name || c.area === name).length;

  return (
    <>
      <PageHeader
        title="Cursos"
        description="Catálogo apresentado no site. Controle a publicação e a abertura de inscrições."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="add" /> Novo curso
          </button>
        }
      />
      <Panel padded={false}>
        <div className="toolbar">
          <Tabs
            value={area}
            onChange={setArea}
            items={[
              { value: '', label: 'Todas', count: counts('') },
              ...(areas.data ?? []).map((a) => ({
                value: a.name,
                label: a.name,
                icon: a.icon,
                count: counts(a.name),
              })),
            ]}
          />
          <SearchField value={q} onChange={setQ} placeholder="Pesquisar curso" />
        </div>
        {courses.error && <ErrorState message={courses.error} onRetry={courses.reload} />}
        {courses.loading && !courses.data && <Skeleton rows={6} />}
        {courses.data && rows.length === 0 && (
          <EmptyState
            icon="school"
            title="Nenhum curso encontrado"
            action={
              <button className="btn btn-primary" onClick={() => setEditing('new')}>
                <Icon name="add" /> Criar curso
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
                    <th>Curso</th>
                    <th className="hide-sm">Inscrições</th>
                    <th className="center">Publicado</th>
                    <th className="center">Inscrições abertas</th>
                    <th aria-label="Acções" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="cell-media">
                          <span className="thumb">
                            {c.imageUrl ? (
                              <Image src={c.imageUrl} alt="" fill sizes="56px" />
                            ) : (
                              <Icon name="school" />
                            )}
                          </span>
                          <span>
                            <button
                              type="button"
                              className="cell-title link-button"
                              onClick={() => setEditing(c)}
                            >
                              {c.name}
                            </button>
                            <small className="cell-sub">
                              {c.area}
                              {c.duration ? ` · ${c.duration}` : ''}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td className="hide-sm">{c._count?.registrations ?? 0}</td>
                      <td className="center">
                        <Switch
                          checked={c.published}
                          label={`Publicar ${c.name}`}
                          onChange={() => toggle(c, 'published')}
                        />
                      </td>
                      <td className="center">
                        <Switch
                          checked={c.enrollmentOpen}
                          label={`Inscrições em ${c.name}`}
                          onChange={() => toggle(c, 'enrollmentOpen')}
                        />
                      </td>
                      <td className="right">
                        <ActionMenu
                          label={c.name}
                          actions={[
                            { label: 'Editar', icon: 'edit', onSelect: () => setEditing(c) },
                            {
                              label: 'Ver no site',
                              icon: 'open_in_new',
                              onSelect: () =>
                                window.open(`/cursos?area=${encodeURIComponent(c.area)}`, '_blank'),
                              hidden: !c.published,
                            },
                            {
                              label: 'Eliminar',
                              icon: 'delete',
                              danger: true,
                              onSelect: () => remove(c),
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
              {rows.map((c) => (
                <ListCard
                  key={c.id}
                  onOpen={() => setEditing(c)}
                  media={
                    <span className="thumb">
                      {c.imageUrl ? (
                        <Image src={c.imageUrl} alt="" fill sizes="56px" />
                      ) : (
                        <Icon name="school" />
                      )}
                    </span>
                  }
                  title={c.name}
                  subtitle={`${c.area}${c.duration ? ` · ${c.duration}` : ''}`}
                  meta={
                    <>
                      <StatusBadge meta={c.published ? PUBLISHED : DRAFT} />
                      <StatusBadge meta={c.enrollmentOpen ? ENROLLMENT_OPEN : ENROLLMENT_CLOSED} />
                      <span>{c._count?.registrations ?? 0} inscrições</span>
                    </>
                  }
                  actions={[
                    { label: 'Editar', icon: 'edit', onSelect: () => setEditing(c) },
                    {
                      label: c.published ? 'Despublicar' : 'Publicar',
                      icon: c.published ? 'public_off' : 'public',
                      onSelect: () => toggle(c, 'published'),
                    },
                    {
                      label: c.enrollmentOpen ? 'Fechar inscrições' : 'Abrir inscrições',
                      icon: c.enrollmentOpen ? 'lock' : 'lock_open',
                      onSelect: () => toggle(c, 'enrollmentOpen'),
                    },
                    {
                      label: 'Ver no site',
                      icon: 'open_in_new',
                      hidden: !c.published,
                      onSelect: () =>
                        window.open(`/cursos?area=${encodeURIComponent(c.area)}`, '_blank'),
                    },
                    { label: 'Eliminar', icon: 'delete', danger: true, onSelect: () => remove(c) },
                  ]}
                />
              ))}
            </CardList>
          </>
        )}
      </Panel>
      {editing && (
        <CourseForm
          course={editing === 'new' ? null : editing}
          areas={areas.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void courses.reload();
          }}
        />
      )}
    </>
  );
}

export function CourseForm({
  course,
  areas,
  onClose,
  onSaved,
}: {
  course: Course | null;
  areas: Area[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<ImageValue | null>(
    course?.imageUrl ? { url: course.imageUrl, publicId: course.imagePublicId } : null,
  );
  const [form, setForm] = useState({
    name: course?.name ?? '',
    area: course?.area ?? areas[0]?.name ?? '',
    description: course?.description ?? '',
    duration: course?.duration ?? '',
    requirements: course?.requirements ?? '',
    published: course?.published ?? true,
    enrollmentOpen: course?.enrollmentOpen ?? true,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form, imageUrl: image?.url ?? '', imagePublicId: image?.publicId ?? '' };
      await apiFetch(course ? `/admin/courses/${course.id}` : '/admin/courses', {
        method: course ? 'PATCH' : 'POST',
        body,
      });
      toast.success(course ? 'Alterações guardadas.' : 'Curso criado com sucesso.');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={course ? 'Editar curso' : 'Novo curso'}
      description="Os campos marcados com * são obrigatórios."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="course-form" className="btn btn-primary" disabled={busy}>
            <Icon name="save" /> {busy ? 'A guardar…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="course-form" className="form-grid-2" onSubmit={submit}>
        <Field label="Imagem do curso" full>
          <ImageUpload value={image} onChange={setImage} folder="cursos" />
        </Field>
        <Field label="Nome" required>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
            minLength={3}
            maxLength={120}
          />
        </Field>
        <Field label="Área" required>
          <select value={form.area} onChange={(e) => set('area', e.target.value)} required>
            {areas.map((a) => (
              <option key={a.name}>{a.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Descrição" full>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={2000}
          />
        </Field>
        <Field label="Duração" hint="Ex.: 3 meses, 120 horas">
          <input
            value={form.duration}
            onChange={(e) => set('duration', e.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="Requisitos" hint="Ex.: 10.ª classe concluída">
          <input
            value={form.requirements}
            onChange={(e) => set('requirements', e.target.value)}
            maxLength={500}
          />
        </Field>
        <div className="switch-row is-full">
          <label>
            <Switch
              checked={form.published}
              onChange={(v) => set('published', v)}
              label="Publicado"
            />{' '}
            Publicado no site
          </label>
          <label>
            <Switch
              checked={form.enrollmentOpen}
              onChange={(v) => set('enrollmentOpen', v)}
              label="Inscrições abertas"
            />{' '}
            Inscrições abertas
          </label>
        </div>
      </form>
    </Modal>
  );
}
