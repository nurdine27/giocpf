import { API_BASE } from '@/lib/api-url';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { areas } from '@/lib/content';
import type { Metadata } from 'next';
type Course = {
  name: string;
  slug: string;
  area: string;
  description: string;
  duration?: string | null;
  requirements?: string | null;
  enrollmentOpen?: boolean;
};
function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
async function getCourse(id: string): Promise<Course | undefined> {
  const original = areas
    .flatMap((a) =>
      a.courses.map((name) => ({
        name,
        slug: slug(name),
        area: a.name,
        description: '',
        enrollmentOpen: true,
      })),
    )
    .find((c) => c.slug === id);
  try {
    const base = API_BASE;
    if (base) {
      const r = await fetch(`${base}/courses`, { cache: 'no-store' });
      if (r.ok) {
        const rows: Course[] = await r.json();
        const found = rows.find((c) => c.slug === id);
        if (found) return found;
      }
    }
  } catch {}
  return original;
}
export function generateStaticParams() {
  return areas.flatMap((a) => a.courses.map((course) => ({ slug: slug(course) })));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const p = await params;
  const row = await getCourse(p.slug);
  return {
    title: row?.name ?? 'Curso',
    description: row ? `${row.name} — ${row.area}, GIO Centro de Formação.` : undefined,
  };
}
export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await params;
  const row = await getCourse(p.slug);
  if (!row) notFound();
  return (
    <main id="conteudo" className="page-wrap">
      <div className="page-heading">
        <div className="section-kicker">{row.area}</div>
        <h1>{row.name}</h1>
        <p>
          {row.description || 'Formação prática e profissionalizante do GIO Centro de Formação.'}
        </p>
      </div>
      <article className="form-card">
        <h2>Sobre esta formação</h2>
        <p>
          Contacte a secretaria para confirmar os requisitos, o horário e a próxima turma deste
          curso.
        </p>
        {row.duration && (
          <p>
            <strong>Duração:</strong> {row.duration}
          </p>
        )}
        {row.requirements && (
          <p>
            <strong>Requisitos:</strong> {row.requirements}
          </p>
        )}
        {row.enrollmentOpen === false ? (
          <p className="page-muted">As inscrições para este curso estão encerradas.</p>
        ) : (
          <Link
            className="button button-primary"
            href={`/inscricao?area=${encodeURIComponent(row.area)}&curso=${encodeURIComponent(row.name)}`}
          >
            Inscrever-me
          </Link>
        )}
      </article>
    </main>
  );
}
