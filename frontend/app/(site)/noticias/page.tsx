import { API_BASE } from '@/lib/api-url';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Icon } from '@/components/icon';
import { EmptyNotice, PageIntro, Pager, formatPublicDate } from '@/components/public-ui';

export const metadata: Metadata = {
  title: 'Notícias',
  description: 'Notícias e actividades do GIO Centro de Formação.',
};

type NewsItem = {
  slug: string;
  title: string;
  summary: string;
  coverUrl: string | null;
  publishedAt: string | null;
  category?: { name: string } | null;
};
type Result = {
  items: NewsItem[];
  page: number;
  pages: number;
  total: number;
  categories: { name: string; slug: string }[];
};

export default async function NoticiasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const query = await searchParams;
  const url = new URL(`${API_BASE}/content/news`);
  for (const [k, v] of Object.entries(query)) if (v) url.searchParams.set(k, v);
  let result: Result = { items: [], page: 1, pages: 0, total: 0, categories: [] };
  try {
    const r = await fetch(url, { next: { revalidate: 60 } });
    if (r.ok) result = await r.json();
  } catch {}

  const link = (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: query.q, category: query.category, ...params }))
      if (v) qs.set(k, v);
    return `/noticias${qs.size ? `?${qs}` : ''}`;
  };

  return (
    <main id="conteudo" className="page-wrap">
      <PageIntro
        title="Notícias"
        lede="Actividades, conquistas e novidades da nossa comunidade."
        crumbs={[{ href: '/noticias', label: 'Notícias' }]}
      />
      <div className="filter-bar">
        <div className="chip-row">
          <Link
            href={link({ category: undefined, page: undefined })}
            className={!query.category ? 'chip is-active' : 'chip'}
          >
            Todas
          </Link>
          {result.categories.map((c) => (
            <Link
              key={c.slug}
              href={link({ category: c.slug, page: undefined })}
              className={query.category === c.slug ? 'chip is-active' : 'chip'}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <form className="search-inline" action="/noticias">
          {query.category && <input type="hidden" name="category" value={query.category} />}
          <Icon name="search" />
          <input
            name="q"
            defaultValue={query.q}
            placeholder="Pesquisar notícias"
            aria-label="Pesquisar notícias"
          />
        </form>
      </div>
      {result.items.length ? (
        <div className="card-grid">
          {result.items.map((n, i) => (
            <article
              className={`news-card ${i === 0 && result.page === 1 ? 'is-featured' : ''}`}
              key={n.slug}
            >
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
                <h2>
                  <Link href={`/noticias/${n.slug}`}>{n.title}</Link>
                </h2>
                {n.summary && <p>{n.summary}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyNotice
          icon="article"
          title={
            query.q || query.category
              ? 'Nenhuma notícia encontrada'
              : 'Ainda não há notícias publicadas'
          }
          text={query.q || query.category ? 'Experimente outra pesquisa ou categoria.' : undefined}
        />
      )}
      <Pager page={result.page} pages={result.pages} href={(p) => link({ page: String(p) })} />
    </main>
  );
}
