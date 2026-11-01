import { API_BASE } from '@/lib/api-url';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Icon } from '@/components/icon';
import { PhotoGrid, formatPublicDate } from '@/components/public-ui';
import { EVENT_STATUS } from '@/lib/constants';

type Ev = {
  title: string;
  description: string;
  location: string;
  coverUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  photos: { url: string; alt: string }[];
};

async function getEvent(slug: string): Promise<Ev | null> {
  try {
    const r = await fetch(`${API_BASE}/content/events/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const e = await getEvent((await params).slug);
  if (!e) return { title: 'Evento não encontrado' };
  const description = e.description.slice(0, 155);
  return {
    title: e.title,
    description,
    openGraph: { title: e.title, description, images: e.coverUrl ? [e.coverUrl] : [] },
  };
}

export default async function EventoDetail({ params }: { params: Promise<{ slug: string }> }) {
  const e = await getEvent((await params).slug);
  if (!e) notFound();
  const status = EVENT_STATUS[e.status];
  return (
    <main id="conteudo" className="page-wrap article-page">
      <Link href="/eventos" className="back-link">
        <Icon name="arrow_back" /> Todos os eventos
      </Link>
      <header className="article-head">
        {status && <span className={`status-pill tone-${status.tone}`}>{status.label}</span>}
        <h1>{e.title}</h1>
        <ul className="event-facts">
          <li>
            <Icon name="calendar_month" /> {formatPublicDate(e.startsAt, true)}
            {e.endsAt && <> — {formatPublicDate(e.endsAt, true)}</>}
          </li>
          {e.location && (
            <li>
              <Icon name="location_on" /> {e.location}
            </li>
          )}
        </ul>
      </header>
      {e.coverUrl && (
        <Image
          className="article-cover"
          src={e.coverUrl}
          alt=""
          width={1200}
          height={680}
          priority
        />
      )}
      {e.description && (
        <article className="article-body">
          {e.description.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </article>
      )}
      {e.photos?.length > 0 && (
        <section className="article-gallery">
          <h2>Fotografias</h2>
          <PhotoGrid photos={e.photos} />
        </section>
      )}
    </main>
  );
}
