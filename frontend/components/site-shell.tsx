'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Icon } from './icon';
export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link className="brand" href="/" onClick={() => setOpen(false)}>
          <Image src="/images/gio-logo2.png" alt="" width={46} height={46} />
          <span>
            GIO<span className="brand-sub">CENTRO DE FORMAÇÃO</span>
          </span>
        </Link>
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
        >
          <Link onClick={() => setOpen(false)} href="/#sobre">
            Sobre nós
          </Link>
          <Link onClick={() => setOpen(false)} href="/cursos">
            Cursos
          </Link>
          <Link onClick={() => setOpen(false)} href="/#identidade">
            Missão e visão
          </Link>
          <Link onClick={() => setOpen(false)} href="/#faq">
            Perguntas frequentes
          </Link>
          <Link onClick={() => setOpen(false)} href="/contactos">
            Contactos
          </Link>
          <Link
            className="button button-primary nav-cta"
            onClick={() => setOpen(false)}
            href="/inscricao"
          >
            Inscrever-me <Icon name="arrow_forward" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <Link className="brand footer-brand" href="/">
            <Image src="/images/gio-logo.png" alt="" width={46} height={46} />
            <span>
              GIO<span className="brand-sub">CENTRO DE FORMAÇÃO</span>
            </span>
          </Link>
          <p>
            Capacitação técnica, desenvolvimento humano e transformação social através de práticas
            educativas inovadoras.
          </p>
        </div>
        <div>
          <h3>Formação</h3>
          <Link href="/cursos">Ver cursos</Link>
          <Link href="/#identidade">Missão e valores</Link>
          <Link href="/inscricao">Inscrição</Link>
        </div>
        <div>
          <h3>Contacto</h3>
          <a href="https://wa.me/258867268483">WhatsApp +258 86 726 8483</a>
          <a href="mailto:giocentrodeformacao@gmail.com">giocentrodeformacao@gmail.com</a>
          <a href="https://www.instagram.com/giocentrodeformacao/">Instagram</a>
          <a href="https://www.facebook.com/search/top?q=Gio%20Centro%20de%20Forma%C3%A7%C3%A3o">
            Facebook
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} GIO Centro de Formação Profissional.</span>
        <Link href="/politica-de-privacidade">Política de Privacidade</Link>
        <Link href="/admin/login">Administração</Link>
      </div>
    </footer>
  );
}
