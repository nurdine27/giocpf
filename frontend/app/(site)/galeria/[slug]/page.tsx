import { API_BASE } from '@/lib/api-url';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Icon } from '@/components/icon';
import { PhotoGrid } from '@/components/public-ui';

type Album = { title: string; description: string; photos: { url: string; alt: string }[] };

async function getAlbum(slug: string): Promise<Album | null> {
  try {
    const r = await fetch(`${API_BASE}/content/albums/${encodeURIComponent(slug)}`, {
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
  const a = await getAlbum((await params).slug);
  return { title: a?.title ?? 'Álbum não encontrado', description: a?.description };
}

export default async function AlbumDetail({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getAlbum((await params).slug);
  if (!a) notFound();
  return (
    <main id="conteudo" className="page-wrap">
      <Link href="/galeria" className="back-link">
        <Icon name="arrow_back" /> Todos os álbuns
      </Link>
      <header className="article-head">
        <h1>{a.title}</h1>
        {a.description && <p className="article-lede">{a.description}</p>}
        <span className="card-meta">
          <Icon name="photo_library" /> {a.photos.length} fotografias
        </span>
      </header>
      <PhotoGrid photos={a.photos} />
    </main>
  );
}
