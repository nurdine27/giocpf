import { API_BASE } from '@/lib/api-url';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Icon } from '@/components/icon';
import { EmptyNotice, PageIntro, Pager } from '@/components/public-ui';
import { EVENT_STATUS } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Eventos',
  description: 'Agenda de eventos do GIO Centro de Formação.',
};

type Ev = {
  slug: string;
  title: string;
  description: string;
  location: string;
  coverUrl: string | null;
  startsAt: string;
  status: string;
};

function EventCard({ e }: { e: Ev }) {
  const date = new Date(e.startsAt);
  const status = EVENT_STATUS[e.status];
  return (
    <article className="event-card">
      <Link href={`/eventos/${e.slug}`} className="event-card-media">
        {e.coverUrl ? (
          <Image src={e.coverUrl} alt="" fill sizes="(max-width: 700px) 100vw, 33vw" />
        ) : (
          <Icon name="event" />
        )}
        <span className="date-badge">
          <strong>{date.getDate()}</strong>
          {date.toLocaleDateString('pt-PT', { month: 'short' })}
        </span>
      </Link>
      <div className="news-card-body">
        <span className="card-meta">
          {status && <span className={`status-pill tone-${status.tone}`}>{status.label}</span>}
          <span>
            <Icon name="schedule" />{' '}
            {date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
        <h2>
          <Link href={`/eventos/${e.slug}`}>{e.title}</Link>
        </h2>
        {e.location && (
          <p className="event-location">
            <Icon name="location_on" /> {e.location}
          </p>
        )}
      </div>
    </article>
  );
}

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  let result: { items: Ev[]; page: number; pages: number } = { items: [], page, pages: 0 };
  try {
    const r = await fetch(`${API_BASE}/content/events?page=${page}`, { next: { revalidate: 60 } });
    if (r.ok) result = await r.json();
  } catch {}
  const now = new Date();
  const upcoming = result.items.filter((e) => new Date(e.startsAt) >= now).reverse();
  const past = result.items.filter((e) => new Date(e.startsAt) < now);

  return (
    <main id="conteudo" className="page-wrap">
      <PageIntro
        title="Eventos"
        lede="Próximas actividades e momentos que marcaram a nossa comunidade."
        crumbs={[{ href: '/eventos', label: 'Eventos' }]}
      />
      {!result.items.length && <EmptyNotice icon="event" title="Ainda não há eventos publicados" />}
      {upcoming.length > 0 && (
        <section className="list-section">
          <h2 className="list-title">Brevemente</h2>
          <div className="card-grid">
            {upcoming.map((e) => (
              <EventCard key={e.slug} e={e} />
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section className="list-section">
          <h2 className="list-title">Já aconteceu</h2>
          <div className="card-grid">
            {past.map((e) => (
              <EventCard key={e.slug} e={e} />
            ))}
          </div>
        </section>
      )}
      <Pager page={result.page} pages={result.pages} href={(p) => `/eventos?page=${p}`} />
    </main>
  );
}
