import { API_BASE } from '@/lib/api-url';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Icon } from '@/components/icon';
import { PhotoGrid, formatPublicDate } from '@/components/public-ui';

type Article = {
  title: string;
  subtitle: string;
  summary: string;
  content: string;
  coverUrl: string | null;
  publishedAt: string | null;
  category?: { name: string; slug: string } | null;
  photos: { url: string; alt: string }[];
};

async function getArticle(slug: string): Promise<Article | null> {
  try {
    const r = await fetch(`${API_BASE}/content/news/${encodeURIComponent(slug)}`, {
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
  const n = await getArticle((await params).slug);
  if (!n) return { title: 'Notícia não encontrada' };
  const description = n.summary || n.subtitle || n.content.slice(0, 155);
  return {
    title: n.title,
    description,
    openGraph: { title: n.title, description, images: n.coverUrl ? [n.coverUrl] : [] },
  };
}

export default async function NewsDetail({ params }: { params: Promise<{ slug: string }> }) {
  const n = await getArticle((await params).slug);
  if (!n) notFound();
  return (
    <main id="conteudo" className="page-wrap article-page">
      <Link href="/noticias" className="back-link">
        <Icon name="arrow_back" /> Todas as notícias
      </Link>
      <header className="article-head">
        <span className="card-meta">
          {n.category && (
            <Link href={`/noticias?category=${n.category.slug}`} className="course-area">
              {n.category.name}
            </Link>
          )}
          <time>{formatPublicDate(n.publishedAt)}</time>
        </span>
        <h1>{n.title}</h1>
        {n.subtitle && <p className="article-lede">{n.subtitle}</p>}
      </header>
      {n.coverUrl && (
        <Image
          className="article-cover"
          src={n.coverUrl}
          alt=""
          width={1200}
          height={680}
          priority
        />
      )}
      <article className="article-body">
        {n.content.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
      {n.photos?.length > 0 && (
        <section className="article-gallery">
          <h2>Fotografias</h2>
          <PhotoGrid photos={n.photos} />
        </section>
      )}
    </main>
  );
}
