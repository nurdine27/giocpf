'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Icon } from '../icon';
import type { StatusMeta, Tone } from '@/lib/constants';
import { initials } from '@/lib/format';
import { errorMessage } from '@/lib/api';

/** Title row of every admin page. The topbar intentionally shows no title so it is never repeated. */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {back}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  icon,
  actions,
  children,
  className = '',
  padded = true,
}: {
  title?: React.ReactNode;
  icon?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`panel ${padded ? '' : 'panel-flush'} ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          <h2>
            {icon && <Icon name={icon} />}
            {title}
          </h2>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  trend,
  tone = 'brand',
  href,
}: {
  label: string;
  value: React.ReactNode;
  icon: string;
  hint?: React.ReactNode;
  trend?: number;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon tone-${tone}`}>
          <Icon name={icon} />
        </span>
      </div>
      <strong className="stat-value">{value}</strong>
      <div className="stat-foot">
        {trend !== undefined && (
          <span className={`stat-trend ${trend >= 0 ? 'is-up' : 'is-down'}`}>
            <Icon name={trend >= 0 ? 'trending_up' : 'trending_down'} />
            {Math.abs(trend)}%
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </>
  );
  return href ? (
    <a href={href} className="stat-card is-link">
      {body}
    </a>
  ) : (
    <div className="stat-card">{body}</div>
  );
}

export function StatusBadge({ meta, fallback }: { meta?: StatusMeta; fallback?: string }) {
  if (!meta) return <span className="badge tone-neutral">{fallback}</span>;
  return (
    <span className={`badge tone-${meta.tone}`}>
      <Icon name={meta.icon} />
      {meta.label}
    </span>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} />
      </span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud_off"
      title="Não foi possível carregar"
      description={message}
      action={
        onRetry && (
          <button className="btn btn-ghost" onClick={onRetry}>
            <Icon name="refresh" /> Tentar novamente
          </button>
        )
      }
    />
  );
}

export function NoAccess() {
  return (
    <EmptyState
      icon="lock"
      title="Sem acesso a esta área"
      description="A sua função não inclui esta permissão. Fale com o administrador principal."
    />
  );
}

export function Skeleton({ rows = 4, height = 48 }: { rows?: number; height?: number }) {
  return (
    <div className="skeleton-stack" aria-busy="true" aria-label="A carregar">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function Avatar({
  name,
  src,
  size = 36,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
}) {
  return src ? (
    <Image
      className="avatar"
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  ) : (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Pesquisar…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onChange(draft), 350);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);
  return (
    <label className="search-field">
      <Icon name="search" />
      <input
        type="search"
        value={draft}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setDraft(e.target.value)}
      />
    </label>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string; icon?: string; count?: number }[];
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={value === item.value ? 'is-active' : ''}
          onClick={() => onChange(item.value)}
        >
          {item.icon && <Icon name={item.icon} />}
          {item.label}
          {item.count !== undefined && <span className="tab-count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export type MenuAction = {
  label: string;
  icon: string;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
};

const MOBILE_QUERY = '(max-width: 760px)';
const MENU_ITEM_HEIGHT = 42;

/**
 * Kebab menu. The list is rendered in a portal with fixed positioning so it is never clipped by
 * scrollable tables; on small screens CSS turns it into a bottom sheet.
 */
export function ActionMenu({
  label,
  actions,
  title,
}: {
  label: string;
  actions: MenuAction[];
  /** Heading shown at the top of the sheet on mobile. */
  title?: string;
}) {
  const [position, setPosition] = useState<React.CSSProperties | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const visible = actions.filter((a) => !a.hidden);
  const open = position !== null;

  function toggle() {
    if (open) return setPosition(null);
    const rect = trigger.current!.getBoundingClientRect();
    if (window.matchMedia(MOBILE_QUERY).matches) return setPosition({});
    const height = visible.length * MENU_ITEM_HEIGHT + 16;
    const below = window.innerHeight - rect.bottom;
    const upwards = below < height + 12 && rect.top > below;
    setPosition({
      right: Math.max(8, window.innerWidth - rect.right),
      ...(upwards ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        trigger.current?.focus();
      }
    };
    // Any scroll would detach a fixed menu from its button, so close instead of following it.
    const onScroll = (e: Event) => !menu.current?.contains(e.target as Node) && close();
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (!visible.length) return null;
  return (
    <div className="action-menu" onClick={(e) => e.stopPropagation()}>
      <button
        ref={trigger}
        type="button"
        className="icon-btn"
        aria-label={`Acções: ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <Icon name="more_vert" />
      </button>
      {open &&
        createPortal(
          <div className="action-menu-portal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="action-sheet-scrim"
              aria-label="Fechar menu"
              onClick={() => setPosition(null)}
            />
            <div
              ref={menu}
              className="action-menu-list is-floating"
              role="menu"
              aria-label={label}
              style={position}
            >
              <div className="action-sheet-head">
                <span className="action-sheet-grip" />
                <strong>{title ?? label}</strong>
              </div>
              {visible.map((a) => (
                <button
                  type="button"
                  role="menuitem"
                  key={a.label}
                  className={a.danger ? 'is-danger' : ''}
                  onClick={() => {
                    setPosition(null);
                    a.onSelect();
                  }}
                >
                  <Icon name={a.icon} />
                  {a.label}
                </button>
              ))}
              <button
                type="button"
                className="action-sheet-cancel"
                onClick={() => setPosition(null)}
              >
                Cancelar
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Mobile replacement for table rows: one card per item with the kebab menu holding every action. */
export function ListCard({
  media,
  title,
  subtitle,
  meta,
  onOpen,
  actions,
  muted,
}: {
  media?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  onOpen?: () => void;
  actions: MenuAction[];
  muted?: boolean;
}) {
  const label = typeof title === 'string' ? title : 'item';
  return (
    <li className={`list-card ${muted ? 'is-muted' : ''}`}>
      <div
        className={`list-card-main ${onOpen ? 'is-clickable' : ''}`}
        onClick={onOpen}
        onKeyDown={(e) =>
          onOpen && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())
        }
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
      >
        {media && <span className="list-card-media">{media}</span>}
        <span className="list-card-copy">
          <strong>{title}</strong>
          {subtitle && <small>{subtitle}</small>}
          {meta && <span className="list-card-meta">{meta}</span>}
        </span>
      </div>
      <ActionMenu label={label} title={label} actions={actions} />
    </li>
  );
}

export function CardList({ children }: { children: React.ReactNode }) {
  return <ul className="card-list only-mobile">{children}</ul>;
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  variant = 'center',
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'center' | 'drawer';
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div
      className={`modal-backdrop ${variant === 'drawer' ? 'modal-drawer' : 'modal-center'}`}
      onMouseDown={onClose}
    >
      <div
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`switch ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total?: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1 && !total) return null;
  return (
    <div className="pagination">
      <span>
        {total !== undefined && `${total} ${total === 1 ? 'registo' : 'registos'} · `}Página {page}{' '}
        de {Math.max(1, pages)}
      </span>
      <div>
        <button
          className="icon-btn"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Página anterior"
        >
          <Icon name="chevron_left" />
        </button>
        <button
          className="icon-btn"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Página seguinte"
        >
          <Icon name="chevron_right" />
        </button>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  full,
  required,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  full?: boolean;
  required?: boolean;
}) {
  return (
    <label className={`form-field ${full ? 'is-full' : ''}`}>
      <span className="form-label">
        {label}
        {required && <em aria-hidden="true"> *</em>}
      </span>
      {children}
      {hint && <small className="form-hint">{hint}</small>}
    </label>
  );
}

/** Loads data when `deps` change and exposes loading, error and an awaitable reload. */
export function useResource<T>(loader: () => Promise<T>, deps: React.DependencyList) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string; data: T | null; error: string }>({
    key: '',
    data: null,
    error: '',
  });
  const waiting = useRef<(() => void)[]>([]);
  const key = JSON.stringify([...deps, version]);

  useEffect(() => {
    let active = true;
    const settle = (next: { data?: T; error: string }) => {
      if (!active) return;
      setState((s) => ({
        key,
        data: next.data === undefined ? s.data : next.data,
        error: next.error,
      }));
      waiting.current.splice(0).forEach((resolve) => resolve());
    };
    loader().then(
      (data) => settle({ data, error: '' }),
      (e) => settle({ error: errorMessage(e) }),
    );
    return () => {
      active = false;
    };
    // `key` captures deps + version; the loader closure is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiting.current.push(resolve);
        setVersion((v) => v + 1);
      }),
    [],
  );
  const setData = useCallback(
    (update: React.SetStateAction<T | null>) =>
      setState((s) => ({
        ...s,
        data:
          typeof update === 'function' ? (update as (prev: T | null) => T | null)(s.data) : update,
      })),
    [],
  );
  return { data: state.data, setData, error: state.error, loading: state.key !== key, reload };
}
