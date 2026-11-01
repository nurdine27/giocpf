import { API_BASE } from '@/lib/api-url';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from './icon';
import { formatPublicDate } from './public-ui';

type HomeData = {
  news: {
    slug: string;
    title: string;
    summary: string;
    coverUrl: string | null;
    publishedAt: string | null;
    category?: { name: string } | null;
  }[];
  events: { slug: string; title: string; startsAt: string; location: string }[];
  albums: { slug: string; title: string; coverUrl: string | null; photos: { url: string }[] }[];
};

export async function PublicUpdates() {
  let data: HomeData = { news: [], events: [], albums: [] };
  try {
    const r = await fetch(`${API_BASE}/content/home`, { next: { revalidate: 60 } });
    if (r.ok) data = await r.json();
  } catch {}
  if (!data.news.length && !data.events.length && !data.albums.length) return null;

  return (
    <section className="section public-updates">
      <div className="section-heading">
        <div>
          <div className="section-kicker">ACONTECE NO GIO</div>
          <h2>Vida e actividades.</h2>
        </div>
        <Link className="text-link" href="/noticias">
          Todas as notícias <Icon name="arrow_forward" />
        </Link>
      </div>
      <div className="updates-layout">
        {data.news.length > 0 && (
          <div className="card-grid card-grid-tight">
            {data.news.map((n) => (
              <article className="news-card" key={n.slug}>
                <Link href={`/noticias/${n.slug}`} className="news-card-media">
                  {n.coverUrl ? (
                    <Image src={n.coverUrl} alt="" fill sizes="(max-width: 700px) 100vw, 33vw" />
                  ) : (
                    <Icon name="article" />
                  )}
                </Link>
                <div className="news-card-body">
                  <span className="card-meta">
                    {n.category && <span className="course-area">{n.category.name}</span>}
                    <time>{formatPublicDate(n.publishedAt)}</time>
                  </span>
                  <h3>
                    <Link href={`/noticias/${n.slug}`}>{n.title}</Link>
                  </h3>
                </div>
              </article>
            ))}
          </div>
        )}
        {data.events.length > 0 && (
          <aside className="agenda">
            <h3>
              <Icon name="calendar_month" /> Agenda
            </h3>
            {data.events.map((e) => {
              const d = new Date(e.startsAt);
              return (
                <Link key={e.slug} href={`/eventos/${e.slug}`} className="agenda-item">
                  <span className="date-badge">
                    <strong>{d.getDate()}</strong>
                    {d.toLocaleDateString('pt-PT', { month: 'short' })}
                  </span>
                  <span>
                    <strong>{e.title}</strong>
                    <small>{e.location}</small>
                  </span>
                </Link>
              );
            })}
            <Link href="/eventos" className="text-link">
              Ver agenda completa <Icon name="arrow_forward" />
            </Link>
          </aside>
        )}
      </div>
      {data.albums.length > 0 && (
        <div className="album-strip">
          {data.albums.map((a) => {
            const cover = a.coverUrl || a.photos?.[0]?.url;
            return (
              <Link key={a.slug} href={`/galeria/${a.slug}`} className="album-card album-card-sm">
                {cover ? (
                  <Image src={cover} alt="" fill sizes="25vw" />
                ) : (
                  <Icon name="photo_library" />
                )}
                <span className="album-card-copy">
                  <strong>{a.title}</strong>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
