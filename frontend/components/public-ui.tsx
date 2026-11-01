import Link from 'next/link';
import { Icon } from './icon';

/** Page title block for public pages. The breadcrumb replaces the old repeated kicker labels. */
export function PageIntro({
  title,
  lede,
  crumbs = [],
  children,
}: {
  title: string;
  lede?: React.ReactNode;
  crumbs?: { href: string; label: string }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <nav className="breadcrumb" aria-label="Localização">
        <Link href="/">Início</Link>
        {crumbs.map((c) => (
          <span key={c.href}>
            <Icon name="chevron_right" />
            <Link href={c.href}>{c.label}</Link>
          </span>
        ))}
      </nav>
      <h1>{title}</h1>
      {lede && <p>{lede}</p>}
      {children}
    </div>
  );
}

export function Pager({
  page,
  pages,
  href,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Paginação">
      {page > 1 ? (
        <Link href={href(page - 1)} className="button button-light">
          <Icon name="arrow_back" /> Anterior
        </Link>
      ) : (
        <span />
      )}
      <span>
        Página {page} de {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="button button-light">
          Seguinte <Icon name="arrow_forward" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function EmptyNotice({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <div className="public-empty">
      <Icon name={icon} />
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </div>
  );
}

export function Notice({
  type = 'success',
  children,
}: {
  type?: 'success' | 'error';
  children: React.ReactNode;
}) {
  return (
    <div className={`notice notice-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon name={type === 'error' ? 'error' : 'check_circle'} />
      <span>{children}</span>
    </div>
  );
}

export function PhotoGrid({ photos }: { photos: { url: string; alt: string }[] }) {
  if (!photos.length) return null;
  return (
    <div className="photo-grid">
      {photos.map((p, i) => (
        <a key={p.url + i} href={p.url} target="_blank" rel="noreferrer" className="photo-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt={p.alt} loading="lazy" />
        </a>
      ))}
    </div>
  );
}

export function formatPublicDate(value?: string | null, withTime = false) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}
