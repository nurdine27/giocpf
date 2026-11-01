import { API_BASE } from '@/lib/api-url';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Icon } from '@/components/icon';
import { EmptyNotice, PageIntro, Pager } from '@/components/public-ui';

export const metadata: Metadata = {
  title: 'Galeria',
  description: 'Fotografias das actividades do GIO Centro de Formação.',
};

type Album = {
  slug: string;
  title: string;
  description: string;
  coverUrl: string | null;
  photos?: { url: string }[];
  _count?: { photos: number };
};

export default async function GaleriaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  let result: { items: Album[]; page: number; pages: number } = { items: [], page, pages: 0 };
  try {
    const r = await fetch(`${API_BASE}/content/albums?page=${page}`, { next: { revalidate: 60 } });
    if (r.ok) result = await r.json();
  } catch {}

  return (
    <main id="conteudo" className="page-wrap">
      <PageIntro
        title="Galeria"
        lede="Actividades, eventos e conquistas da nossa comunidade em imagens."
        crumbs={[{ href: '/galeria', label: 'Galeria' }]}
      />
      {result.items.length ? (
        <div className="album-grid">
          {result.items.map((a) => {
            const cover = a.coverUrl || a.photos?.[0]?.url;
            return (
              <Link className="album-card" href={`/galeria/${a.slug}`} key={a.slug}>
                {cover ? (
                  <Image src={cover} alt="" fill sizes="(max-width: 700px) 100vw, 33vw" />
                ) : (
                  <Icon name="photo_library" />
                )}
                <span className="album-card-copy">
                  <strong>{a.title}</strong>
                  <small>
                    <Icon name="photo_library" /> {a._count?.photos ?? 0} fotografias
                  </small>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyNotice icon="photo_library" title="Ainda não há álbuns publicados" />
      )}
      <Pager page={result.page} pages={result.pages} href={(p) => `/galeria?page=${p}`} />
    </main>
  );
}
