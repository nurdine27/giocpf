'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '../icon';
import { Avatar, NoAccess, Skeleton } from './ui';
import { FeedbackProvider, useConfirm, useToast } from './feedback';
import { apiFetch } from '@/lib/api';
import { ADMIN_NAV, type Badges, type NavItem, type Permission } from '@/lib/constants';

export type Identity = {
  id: string;
  email: string;
  displayName: string;
  profilePhotoUrl: string | null;
  isSuperAdmin: boolean;
  role: { id: string; name: string } | null;
  permissions: Permission[];
};

type AdminContextValue = {
  me: Identity;
  can: (...permissions: Permission[]) => boolean;
  refreshMe: () => Promise<void>;
  refreshBadges: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside AdminLayout');
  return ctx;
}

/** Renders children only when the admin has at least one of the permissions. */
export function RequirePermission({
  any,
  children,
}: {
  any: Permission[];
  children: React.ReactNode;
}) {
  const { can } = useAdmin();
  return can(...any) ? <>{children}</> : <NoAccess />;
}

function isActive(path: string, href: string) {
  return href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`);
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === '/admin/login') return <FeedbackProvider>{children}</FeedbackProvider>;
  return (
    <FeedbackProvider>
      <AdminShell>{children}</AdminShell>
    </FeedbackProvider>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [me, setMe] = useState<Identity | null>(null);
  const [badges, setBadges] = useState<Badges>({ pendingRegistrations: 0, unreadMessages: 0 });
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('gio-sidebar') === 'collapsed',
  );
  const [drawer, setDrawer] = useState(false);

  const refreshMe = useCallback(async () => {
    setMe(await apiFetch<Identity>('/auth/me'));
  }, []);
  const refreshBadges = useCallback(async () => {
    const next = await apiFetch<Badges>('/admin/badges').catch(() => null);
    if (next) setBadges(next);
  }, []);

  useEffect(() => {
    apiFetch<Identity>('/auth/me')
      .then(setMe)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    // Counters are refreshed on every navigation so badges stay current.
    apiFetch<Badges>('/admin/badges')
      .then(setBadges)
      .catch(() => undefined);
  }, [path]);

  const can = useCallback(
    (...permissions: Permission[]) =>
      Boolean(
        me && (permissions.length === 0 || permissions.some((p) => me.permissions.includes(p))),
      ),
    [me],
  );

  function toggleCollapsed() {
    localStorage.setItem('gio-sidebar', collapsed ? 'expanded' : 'collapsed');
    setCollapsed(!collapsed);
  }

  async function logout() {
    const ok = await confirm({
      title: 'Terminar sessão?',
      message: 'Terá de introduzir novamente o e-mail e a palavra-passe para voltar.',
      confirmLabel: 'Terminar sessão',
      tone: 'primary',
      icon: 'logout',
    });
    if (!ok) return;
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    toast.info('Sessão terminada com segurança.');
    router.replace('/admin/login');
  }

  const groups = ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items.filter((item) => can(...item.permissions)),
  })).filter((g) => g.items.length);
  // Mobile bottom bar: the first four sections the admin can open, plus "Mais" for the drawer.
  const quickLinks = groups.flatMap((g) => g.items).slice(0, 4);

  return (
    <div className={`admin-app ${collapsed ? 'is-collapsed' : ''}`} suppressHydrationWarning>
      <aside className={`sidebar ${drawer ? 'is-open' : ''}`} aria-label="Menu de administração">
        <div className="sidebar-brand">
          <Link href="/admin" className="sidebar-logo">
            <Image src="/images/gio-logo.png" alt="" width={36} height={36} />
            <span>
              GIO CPF<small>Gestão institucional</small>
            </span>
          </Link>
          <button
            className="icon-btn sidebar-toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <Icon name={collapsed ? 'left_panel_open' : 'left_panel_close'} />
          </button>
        </div>
        <nav
          className="sidebar-nav"
          onClick={(e) => (e.target as HTMLElement).closest('a') && setDrawer(false)}
        >
          {!me && <Skeleton rows={6} height={40} />}
          {groups.map((g) => (
            <div key={g.group} className="sidebar-group">
              <span className="sidebar-group-label">{g.group}</span>
              {g.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(path, item.href)}
                  count={item.badge ? badges[item.badge] : 0}
                />
              ))}
            </div>
          ))}
        </nav>
        <Link href="/" target="_blank" className="sidebar-site">
          <Icon name="open_in_new" />
          <span>Visitar o site</span>
        </Link>
      </aside>
      {drawer && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setDrawer(false)}
        />
      )}

      <div className="admin-main">
        <header className="topbar">
          <button
            className="icon-btn topbar-menu"
            onClick={() => setDrawer(true)}
            aria-label="Abrir menu"
          >
            <Icon name="menu" />
          </button>
          <div className="topbar-spacer" />
          {can('messages.read') && (
            <Link
              href="/admin/mensagens"
              className="icon-btn topbar-bell"
              aria-label={`${badges.unreadMessages} mensagens não lidas`}
            >
              <Icon name="notifications" />
              {badges.unreadMessages > 0 && (
                <span className="dot-count">{badges.unreadMessages}</span>
              )}
            </Link>
          )}
          {me && <UserMenu me={me} onLogout={logout} />}
        </header>
        <main id="conteudo" className="admin-content">
          {me ? (
            <AdminContext.Provider value={{ me, can, refreshMe, refreshBadges }}>
              {children}
            </AdminContext.Provider>
          ) : (
            <Skeleton rows={5} height={90} />
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Navegação rápida">
        {quickLinks.map((item) => {
          const count = item.badge ? badges[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(path, item.href) ? 'is-active' : ''}
              aria-current={isActive(path, item.href) ? 'page' : undefined}
            >
              <span className="bottom-nav-icon">
                <Icon name={item.icon} />
                {count > 0 && <span className="dot-count">{count > 99 ? '99+' : count}</span>}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setDrawer(true)}>
          <span className="bottom-nav-icon">
            <Icon name="menu" />
          </span>
          <span>Mais</span>
        </button>
      </nav>
    </div>
  );
}

function NavLink({ item, active, count }: { item: NavItem; active: boolean; count: number }) {
  return (
    <Link
      href={item.href}
      className={`sidebar-link ${active ? 'is-active' : ''}`}
      title={item.label}
      aria-current={active ? 'page' : undefined}
    >
      <Icon name={item.icon} />
      <span className="sidebar-label">{item.label}</span>
      {count > 0 && <span className="sidebar-count">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}

function UserMenu({ me, onLogout }: { me: Identity; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const name = me.displayName || me.email;
  return (
    <div className="user-menu" ref={ref}>
      <button
        className="user-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar name={name} src={me.profilePhotoUrl} size={36} />
        <span className="user-meta">
          <strong>{name}</strong>
          <small>
            {me.isSuperAdmin ? 'Administrador principal' : (me.role?.name ?? 'Sem função')}
          </small>
        </span>
        <Icon name="expand_more" />
      </button>
      {open && (
        <div className="action-menu-list user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <strong>{name}</strong>
            <small>{me.email}</small>
          </div>
          <Link href="/admin/perfil" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="person" /> O meu perfil
          </Link>
          <button
            role="menuitem"
            className="is-danger"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <Icon name="logout" /> Terminar sessão
          </button>
        </div>
      )}
    </div>
  );
}
