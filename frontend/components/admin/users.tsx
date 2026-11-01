'use client';
import { useState } from 'react';
import { Icon } from '../icon';
import { useAdmin } from './admin-layout';
import { useConfirm, useToast } from './feedback';
import {
  ActionMenu,
  Avatar,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  Panel,
  Skeleton,
  Tabs,
  useResource,
  CardList,
  ListCard,
} from './ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { relativeTime } from '@/lib/format';

type PermissionDef = { key: string; label: string; group: string };
type Role = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  _count?: { users: number };
};
type AdminRow = {
  id: string;
  email: string;
  displayName: string;
  profilePhotoUrl: string | null;
  isSuperAdmin: boolean;
  active: boolean;
  permissions: string[];
  effectivePermissions: string[];
  lastLoginAt: string | null;
  role: { id: string; name: string } | null;
};

export function TeamAdmin() {
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const users = useResource(() => apiFetch<AdminRow[]>('/admin/admin-users'), []);
  const roles = useResource(() => apiFetch<Role[]>('/admin/roles'), []);
  const permissions = useResource(() => apiFetch<PermissionDef[]>('/admin/permissions'), []);
  const [editingUser, setEditingUser] = useState<AdminRow | 'new' | null>(null);
  const [editingRole, setEditingRole] = useState<Role | 'new' | null>(null);

  return (
    <>
      <PageHeader
        title="Equipa e funções"
        description="Contas da equipa administrativa e o que cada função pode fazer."
        actions={
          tab === 'users' ? (
            <button className="btn btn-primary" onClick={() => setEditingUser('new')}>
              <Icon name="person_add" /> Novo membro
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setEditingRole('new')}>
              <Icon name="add_moderator" /> Nova função
            </button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'users', label: 'Membros', icon: 'group', count: users.data?.length },
          {
            value: 'roles',
            label: 'Funções e permissões',
            icon: 'shield_person',
            count: roles.data?.length,
          },
        ]}
      />
      {tab === 'users' ? (
        <UsersTable state={users} onEdit={setEditingUser} />
      ) : (
        <RolesGrid
          state={roles}
          permissions={permissions.data ?? []}
          onEdit={setEditingRole}
          onChanged={() => {
            void roles.reload();
            void users.reload();
          }}
        />
      )}
      {editingUser && roles.data && permissions.data && (
        <UserForm
          user={editingUser === 'new' ? null : editingUser}
          roles={roles.data}
          permissions={permissions.data}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            void users.reload();
            void roles.reload();
          }}
        />
      )}
      {editingRole && permissions.data && (
        <RoleForm
          role={editingRole === 'new' ? null : editingRole}
          permissions={permissions.data}
          onClose={() => setEditingRole(null)}
          onSaved={() => {
            setEditingRole(null);
            void roles.reload();
            void users.reload();
          }}
        />
      )}
    </>
  );
}

function UsersTable({
  state,
  onEdit,
}: {
  state: ReturnType<typeof useResource<AdminRow[]>>;
  onEdit: (u: AdminRow) => void;
}) {
  const { me } = useAdmin();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = state;

  async function toggleActive(u: AdminRow) {
    const ok = await confirm({
      title: u.active ? 'Desactivar conta?' : 'Reactivar conta?',
      message: u.active ? (
        <>
          <strong>{u.displayName || u.email}</strong> deixa de conseguir iniciar sessão e as sessões
          abertas são terminadas.
        </>
      ) : (
        <>
          <strong>{u.displayName || u.email}</strong> volta a poder iniciar sessão.
        </>
      ),
      confirmLabel: u.active ? 'Desactivar' : 'Reactivar',
      tone: u.active ? 'danger' : 'primary',
      icon: u.active ? 'person_off' : 'how_to_reg',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/admin-users/${u.id}`, {
        method: 'PATCH',
        body: { active: !u.active },
      });
      toast.success(u.active ? 'Conta desactivada.' : 'Conta reactivada.');
      void reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function remove(u: AdminRow) {
    const ok = await confirm({
      title: 'Eliminar conta?',
      message: (
        <>
          A conta <strong>{u.email}</strong> será eliminada permanentemente. Se tiver conteúdos
          associados, desactive-a em vez disso.
        </>
      ),
      confirmLabel: 'Eliminar',
      icon: 'person_remove',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/admin-users/${u.id}`, { method: 'DELETE' });
      toast.success('Conta eliminada.');
      void reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Panel padded={false}>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={4} height={60} />}
      {data && (
        <>
          <div className="table-wrap only-desktop">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Membro</th>
                  <th>Função</th>
                  <th className="hide-sm">Permissões</th>
                  <th className="hide-sm">Último acesso</th>
                  <th aria-label="Acções" />
                </tr>
              </thead>
              <tbody>
                {data.map((u) => {
                  const self = u.id === me.id;
                  return (
                    <tr key={u.id} className={u.active ? '' : 'is-muted'}>
                      <td>
                        <div className="cell-media">
                          <Avatar
                            name={u.displayName || u.email}
                            src={u.profilePhotoUrl}
                            size={38}
                          />
                          <span>
                            <span className="cell-title">
                              {u.displayName || u.email.split('@')[0]}
                              {self && <span className="badge tone-brand badge-sm">Você</span>}
                            </span>
                            <small className="cell-sub">{u.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        {u.isSuperAdmin ? (
                          <span className="badge tone-brand">
                            <Icon name="verified_user" /> Administrador principal
                          </span>
                        ) : u.active ? (
                          <span className="badge tone-info">
                            <Icon name="shield_person" /> {u.role?.name ?? 'Sem função'}
                          </span>
                        ) : (
                          <span className="badge tone-neutral">
                            <Icon name="person_off" /> Desactivada
                          </span>
                        )}
                      </td>
                      <td className="hide-sm">
                        <span
                          className="perm-meter"
                          title={`${u.effectivePermissions.length} de 12 permissões`}
                        >
                          <span
                            style={{ width: `${(u.effectivePermissions.length / 12) * 100}%` }}
                          />
                        </span>
                        <small className="cell-sub">
                          {u.effectivePermissions.length} permissões
                        </small>
                      </td>
                      <td className="hide-sm">
                        {u.lastLoginAt ? relativeTime(u.lastLoginAt) : 'Nunca'}
                      </td>
                      <td className="right">
                        {!u.isSuperAdmin && (
                          <ActionMenu
                            label={u.email}
                            actions={[
                              { label: 'Editar acesso', icon: 'edit', onSelect: () => onEdit(u) },
                              {
                                label: u.active ? 'Desactivar' : 'Reactivar',
                                icon: u.active ? 'person_off' : 'how_to_reg',
                                hidden: self,
                                onSelect: () => toggleActive(u),
                              },
                              {
                                label: 'Eliminar',
                                icon: 'delete',
                                danger: true,
                                hidden: self,
                                onSelect: () => remove(u),
                              },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <CardList>
            {data.map((u) => {
              const self = u.id === me.id;
              return (
                <ListCard
                  key={u.id}
                  muted={!u.active}
                  onOpen={u.isSuperAdmin ? undefined : () => onEdit(u)}
                  media={
                    <Avatar name={u.displayName || u.email} src={u.profilePhotoUrl} size={42} />
                  }
                  title={u.displayName || u.email.split('@')[0]}
                  subtitle={u.email}
                  meta={
                    <>
                      {u.isSuperAdmin ? (
                        <span className="badge tone-brand">
                          <Icon name="verified_user" /> Principal
                        </span>
                      ) : u.active ? (
                        <span className="badge tone-info">
                          <Icon name="shield_person" /> {u.role?.name ?? 'Sem função'}
                        </span>
                      ) : (
                        <span className="badge tone-neutral">
                          <Icon name="person_off" /> Desactivada
                        </span>
                      )}
                      {self && <span className="badge tone-brand">Você</span>}
                      <span>
                        {u.lastLoginAt ? `Acesso ${relativeTime(u.lastLoginAt)}` : 'Nunca acedeu'}
                      </span>
                    </>
                  }
                  actions={
                    u.isSuperAdmin
                      ? []
                      : [
                          { label: 'Editar acesso', icon: 'edit', onSelect: () => onEdit(u) },
                          {
                            label: u.active ? 'Desactivar' : 'Reactivar',
                            icon: u.active ? 'person_off' : 'how_to_reg',
                            hidden: self,
                            onSelect: () => toggleActive(u),
                          },
                          {
                            label: 'Eliminar',
                            icon: 'delete',
                            danger: true,
                            hidden: self,
                            onSelect: () => remove(u),
                          },
                        ]
                  }
                />
              );
            })}
          </CardList>
        </>
      )}
    </Panel>
  );
}

function RolesGrid({
  state,
  permissions,
  onEdit,
  onChanged,
}: {
  state: ReturnType<typeof useResource<Role[]>>;
  permissions: PermissionDef[];
  onEdit: (r: Role) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = state;
  const label = (key: string) => permissions.find((p) => p.key === key)?.label ?? key;

  async function remove(r: Role) {
    const ok = await confirm({
      title: 'Eliminar função?',
      message: (
        <>
          A função <strong>{r.name}</strong> será eliminada.
          {r._count?.users ? (
            <> Os {r._count.users} membros com esta função ficam sem função atribuída.</>
          ) : null}
        </>
      ),
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/roles/${r.id}`, { method: 'DELETE' });
      toast.success('Função eliminada.');
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <Skeleton rows={3} height={140} />;
  if (!data?.length) return <EmptyState icon="shield_person" title="Sem funções" />;
  return (
    <div className="role-grid">
      {data.map((r) => (
        <Panel
          key={r.id}
          title={r.name}
          icon={r.isSystem ? 'verified_user' : 'shield_person'}
          actions={
            !r.isSystem && (
              <ActionMenu
                label={r.name}
                actions={[
                  { label: 'Editar', icon: 'edit', onSelect: () => onEdit(r) },
                  { label: 'Eliminar', icon: 'delete', danger: true, onSelect: () => remove(r) },
                ]}
              />
            )
          }
        >
          <p className="muted-text">{r.description || 'Sem descrição.'}</p>
          <div className="chip-list">
            {r.permissions.map((p) => (
              <span key={p} className="chip">
                {label(p)}
              </span>
            ))}
            {!r.permissions.length && <span className="muted-text">Sem permissões.</span>}
          </div>
          <div className="role-foot">
            <span>
              <Icon name="group" /> {r._count?.users ?? 0} membros
            </span>
            {r.isSystem && (
              <span className="badge tone-neutral badge-sm">
                <Icon name="lock" /> Do sistema
              </span>
            )}
          </div>
        </Panel>
      ))}
    </div>
  );
}

/** Checkboxes grouped by area; `locked` permissions come from the role and are shown checked/disabled. */
function PermissionPicker({
  permissions,
  value,
  onChange,
  locked = [],
}: {
  permissions: PermissionDef[];
  value: string[];
  onChange: (value: string[]) => void;
  locked?: string[];
}) {
  const groups = [...new Set(permissions.map((p) => p.group))];
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div className="perm-groups">
      {groups.map((g) => {
        const items = permissions.filter((p) => p.group === g);
        const all = items.every((p) => value.includes(p.key) || locked.includes(p.key));
        return (
          <fieldset key={g} className="perm-group">
            <legend>
              {g}
              <button
                type="button"
                className="link-button"
                onClick={() =>
                  onChange(
                    all
                      ? value.filter((k) => !items.some((p) => p.key === k))
                      : [...new Set([...value, ...items.map((p) => p.key)])],
                  )
                }
              >
                {all ? 'Limpar' : 'Todas'}
              </button>
            </legend>
            {items.map((p) => (
              <label key={p.key} className="check-row">
                <input
                  type="checkbox"
                  checked={value.includes(p.key) || locked.includes(p.key)}
                  disabled={locked.includes(p.key)}
                  onChange={() => toggle(p.key)}
                />
                <span>{p.label}</span>
                {locked.includes(p.key) && <small>pela função</small>}
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

function UserForm({
  user,
  roles,
  permissions,
  onClose,
  onSaved,
}: {
  user: AdminRow | null;
  roles: Role[];
  permissions: PermissionDef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(user?.email ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(
    // New members start with the least-privileged role.
    user
      ? (user.role?.id ?? '')
      : ([...roles].sort((a, b) => a.permissions.length - b.permissions.length)[0]?.id ?? ''),
  );
  const [extra, setExtra] = useState<string[]>(user?.permissions ?? []);
  const rolePermissions = roles.find((r) => r.id === roleId)?.permissions ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const permissionsBody = extra.filter((p) => !rolePermissions.includes(p));
    try {
      await apiFetch(user ? `/admin/admin-users/${user.id}` : '/admin/admin-users', {
        method: user ? 'PATCH' : 'POST',
        body: user
          ? { displayName, roleId, permissions: permissionsBody }
          : { email, displayName, password, roleId, permissions: permissionsBody },
      });
      toast.success(
        user
          ? 'Acessos actualizados.'
          : 'Membro criado. Partilhe a palavra-passe temporária em segurança.',
      );
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const values = crypto.getRandomValues(new Uint32Array(16));
    setPassword(Array.from(values, (v) => chars[v % chars.length]).join(''));
  }

  return (
    <Modal
      title={user ? 'Editar acesso' : 'Novo membro da equipa'}
      description={user ? user.email : 'A pessoa poderá alterar a palavra-passe no seu perfil.'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="user-form" className="btn btn-primary" disabled={busy}>
            <Icon name="save" /> {busy ? 'A guardar…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="user-form" className="form-grid-2" onSubmit={submit}>
        {!user && (
          <Field label="E-mail" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </Field>
        )}
        <Field label="Nome">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
          />
        </Field>
        {!user && (
          <Field label="Palavra-passe temporária" required hint="Mínimo 12 caracteres." full>
            <div className="input-group">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
              />
              <button type="button" className="btn btn-ghost" onClick={generatePassword}>
                <Icon name="casino" /> Gerar
              </button>
            </div>
          </Field>
        )}
        <Field label="Função" full hint="Define o conjunto base de permissões.">
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">Sem função</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="is-full">
          <span className="form-label">Permissões adicionais</span>
          <PermissionPicker
            permissions={permissions}
            value={extra}
            onChange={setExtra}
            locked={rolePermissions}
          />
        </div>
      </form>
    </Modal>
  );
}

function RoleForm({
  role,
  permissions,
  onClose,
  onSaved,
}: {
  role: Role | null;
  permissions: PermissionDef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? ['dashboard.read']);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch(role ? `/admin/roles/${role.id}` : '/admin/roles', {
        method: role ? 'PATCH' : 'POST',
        body: { name, description, permissions: selected },
      });
      toast.success(role ? 'Função actualizada.' : 'Função criada.');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={role ? 'Editar função' : 'Nova função'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="role-form" className="btn btn-primary" disabled={busy}>
            <Icon name="save" /> {busy ? 'A guardar…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="role-form" className="form-grid-2" onSubmit={submit}>
        <Field label="Nome" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={3}
            maxLength={60}
          />
        </Field>
        <Field label="Descrição">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={240}
          />
        </Field>
        <div className="is-full">
          <span className="form-label">Permissões ({selected.length})</span>
          <PermissionPicker permissions={permissions} value={selected} onChange={setSelected} />
        </div>
      </form>
    </Modal>
  );
}
