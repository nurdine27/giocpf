'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';
import { CookiePreferencesLink } from './cookie-consent';
import { NAV_LINKS, whatsappLink, type SiteInfo } from '@/lib/site';

function Brand({ site, light }: { site: SiteInfo; light?: boolean }) {
  return (
    <Link className={`brand ${light ? 'footer-brand' : ''}`} href="/">
      <Image
        src={site.logoUrl || (light ? '/images/gio-logo.png' : '/images/gio-logo2.png')}
        alt=""
        width={46}
        height={46}
      />
      <span>
        {site.shortName}
        <span className="brand-sub">CENTRO DE FORMAÇÃO</span>
      </span>
    </Link>
  );
}

export function Header({ site }: { site: SiteInfo }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Brand site={site} />
        <button
          className="menu-toggle"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-controls="primary-nav"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? 'close' : 'menu'} />
        </button>
        <nav
          id="primary-nav"
          className={open ? 'nav-links is-open' : 'nav-links'}
          aria-label="Navegação principal"
          onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={isActive(link.href) ? 'is-active' : ''}
              aria-current={isActive(link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
          <Link className="button button-primary nav-cta" href="/inscricao">
            Inscrever-me <Icon name="arrow_forward" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer({ site }: { site: SiteInfo }) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <Brand site={site} light />
          <p>
            Capacitação técnica, desenvolvimento humano e transformação social através de práticas
            educativas inovadoras.
          </p>
        </div>
        <div>
          <h3>Formação</h3>
          <Link href="/cursos">Catálogo de cursos</Link>
          <Link href="/inscricao">Fazer inscrição</Link>
          <Link href="/#faq">Perguntas frequentes</Link>
        </div>
        <div>
          <h3>Contacto</h3>
          <a href={whatsappLink(site.whatsapp)}>
            <Icon name="chat" /> {site.phone}
          </a>
          <a href={`mailto:${site.email}`}>
            <Icon name="mail" /> {site.email}
          </a>
          {site.address && (
            <span>
              <Icon name="location_on" /> {site.address}
            </span>
          )}
          <span className="footer-social">
            <a href={site.instagram} aria-label="Instagram" target="_blank" rel="noreferrer">
              <Icon name="photo_camera" />
            </a>
            <a href={site.facebook} aria-label="Facebook" target="_blank" rel="noreferrer">
              <Icon name="public" />
            </a>
          </span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {site.name}.
        </span>
        <Link href="/politica-de-privacidade">Política de Privacidade</Link>
        <CookiePreferencesLink />
        <Link href="/admin/login">Área administrativa</Link>
      </div>
    </footer>
  );
}
