'use client';
import { useState } from 'react';
import { Icon } from '../icon';
import { useAdmin } from './admin-layout';
import { useToast } from './feedback';
import { ImageUpload, type ImageValue } from './image-upload';
import { ErrorState, Field, PageHeader, Panel, Skeleton, useResource } from './ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';

type Profile = {
  email: string;
  displayName: string;
  phone: string | null;
  profilePhotoUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  isSuperAdmin: boolean;
  role: { name: string } | null;
  permissions: string[];
};

export function AdminProfile() {
  const { data, error, loading, reload } = useResource(
    () => apiFetch<Profile>('/admin/profile'),
    [],
  );
  return (
    <>
      <PageHeader title="O meu perfil" description="Dados pessoais e segurança da sua conta." />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={3} height={140} />}
      {data && <ProfileView data={data} />}
    </>
  );
}

function ProfileView({ data }: { data: Profile }) {
  const toast = useToast();
  const { refreshMe } = useAdmin();
  const [form, setForm] = useState({ displayName: data.displayName, phone: data.phone ?? '' });
  const [photo, setPhoto] = useState<ImageValue | null>(
    data.profilePhotoUrl ? { url: data.profilePhotoUrl } : null,
  );
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/admin/profile', {
        method: 'PATCH',
        body: {
          ...form,
          profilePhotoUrl: photo?.url ?? '',
          profilePhotoPublicId: photo?.publicId ?? '',
        },
      });
      await refreshMe();
      toast.success('Perfil actualizado.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="detail-grid">
      <div className="detail-main">
        <Panel title="Dados pessoais" icon="person">
          <form onSubmit={save} className="profile-form">
            <ImageUpload
              value={photo}
              onChange={setPhoto}
              folder="perfis"
              shape="round"
              label="Fotografia"
            />
            <div className="form-grid-2">
              <Field label="Nome">
                <input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  maxLength={120}
                />
              </Field>
              <Field label="Telefone">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  maxLength={40}
                />
              </Field>
              <Field label="E-mail da conta" hint="Contacte o administrador para alterar." full>
                <input value={data.email} disabled />
              </Field>
              <div className="is-full">
                <button className="btn btn-primary" disabled={busy}>
                  <Icon name="save" /> {busy ? 'A guardar…' : 'Guardar perfil'}
                </button>
              </div>
            </div>
          </form>
        </Panel>
        <PasswordPanel />
      </div>
      <Panel title="Conta" icon="badge" className="detail-side">
        <dl className="info-list info-list-stack">
          <div>
            <dt>
              <Icon name="shield_person" /> Função
            </dt>
            <dd>
              {data.isSuperAdmin ? 'Administrador principal' : (data.role?.name ?? 'Sem função')}
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="key" /> Permissões
            </dt>
            <dd>{data.permissions.length}</dd>
          </div>
          <div>
            <dt>
              <Icon name="calendar_today" /> Membro desde
            </dt>
            <dd>{formatDate(data.createdAt)}</dd>
          </div>
          <div>
            <dt>
              <Icon name="login" /> Último acesso
            </dt>
            <dd>{formatDateTime(data.lastLoginAt)}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}

function PasswordPanel() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const mismatch = form.confirm.length > 0 && form.confirm !== form.newPassword;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    try {
      await apiFetch('/admin/profile/password', {
        method: 'PATCH',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Palavra-passe alterada.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const type = show ? 'text' : 'password';
  return (
    <Panel
      title="Palavra-passe"
      icon="lock"
      actions={
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShow(!show)}>
          <Icon name={show ? 'visibility_off' : 'visibility'} /> {show ? 'Ocultar' : 'Mostrar'}
        </button>
      }
    >
      <form className="form-grid-2" onSubmit={submit}>
        <Field label="Palavra-passe actual" required full>
          <input
            type={type}
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            required
            autoComplete="current-password"
          />
        </Field>
        <Field label="Nova palavra-passe" required hint="Mínimo 12 caracteres.">
          <input
            type={type}
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            required
            minLength={12}
            autoComplete="new-password"
          />
        </Field>
        <Field
          label="Confirmar"
          required
          hint={mismatch ? 'As palavras-passe não coincidem.' : undefined}
        >
          <input
            type={type}
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            required
            aria-invalid={mismatch}
            autoComplete="new-password"
          />
        </Field>
        <div className="is-full">
          <button className="btn btn-primary" disabled={busy || mismatch}>
            <Icon name="lock_reset" /> {busy ? 'A alterar…' : 'Alterar palavra-passe'}
          </button>
        </div>
      </form>
    </Panel>
  );
}
