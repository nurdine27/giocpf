import Link from 'next/link';
import { Footer, Header } from '@/components/site-shell';
import { Icon } from '@/components/icon';
import { getSiteInfo } from '@/lib/site';

export default async function NotFound() {
  const site = await getSiteInfo();
  return (
    <>
      <Header site={site} />
      <main id="conteudo" className="page-wrap">
        <div className="success-card">
          <span className="success-icon is-muted">
            <Icon name="travel_explore" />
          </span>
          <h1>Página não encontrada</h1>
          <p>O endereço pode ter mudado ou o conteúdo já não está publicado.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/cursos">
              Ver cursos <Icon name="arrow_forward" />
            </Link>
            <Link className="button button-light" href="/">
              Voltar ao início
            </Link>
          </div>
        </div>
      </main>
      <Footer site={site} />
    </>
  );
}
