import { API_BASE } from '@/lib/api-url';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { areas } from '@/lib/content';
import { Icon } from '@/components/icon';
import { PageIntro } from '@/components/public-ui';

type Course = {
  name: string;
  slug: string;
  area: string;
  description: string;
  duration?: string | null;
  requirements?: string | null;
  imageUrl?: string | null;
  enrollmentOpen?: boolean;
};

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function getCourse(id: string): Promise<Course | undefined> {
  try {
    const r = await fetch(`${API_BASE}/courses`, { next: { revalidate: 60 } });
    if (r.ok) {
      const rows: Course[] = await r.json();
      const found = rows.find((c) => c.slug === id);
      if (found) return found;
    }
  } catch {}
  return areas
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
}

export function generateStaticParams() {
  return areas.flatMap((a) => a.courses.map((course) => ({ slug: slug(course) })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const row = await getCourse((await params).slug);
  return {
    title: row?.name ?? 'Curso',
    description: row
      ? row.description || `${row.name} — ${row.area}, GIO Centro de Formação.`
      : undefined,
  };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const row = await getCourse((await params).slug);
  if (!row) notFound();
  const icon = areas.find((a) => a.name === row.area)?.icon ?? 'school';
  const facts = [
    { icon, label: 'Área', value: row.area },
    { icon: 'schedule', label: 'Duração', value: row.duration || 'A confirmar com a secretaria' },
    {
      icon: 'checklist',
      label: 'Requisitos',
      value: row.requirements || 'A confirmar com a secretaria',
    },
    { icon: 'workspace_premium', label: 'Certificação', value: 'Certificado de conclusão' },
  ];
  return (
    <main id="conteudo" className="page-wrap">
      <PageIntro
        title={row.name}
        lede={
          row.description ||
          'Formação prática e profissionalizante, com aulas orientadas para o mercado de trabalho.'
        }
        crumbs={[
          { href: '/cursos', label: 'Cursos' },
          { href: `/cursos?area=${encodeURIComponent(row.area)}`, label: row.area },
        ]}
      />
      <div className="course-detail">
        <div className="course-detail-media">
          {row.imageUrl ? (
            <Image src={row.imageUrl} alt="" fill sizes="(max-width: 800px) 100vw, 60vw" priority />
          ) : (
            <Icon name={icon} />
          )}
        </div>
        <aside className="form-card course-facts">
          <dl>
            {facts.map((f) => (
              <div key={f.label}>
                <dt>
                  <Icon name={f.icon} /> {f.label}
                </dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          {row.enrollmentOpen === false ? (
            <p className="status-pill tone-neutral">
              As inscrições para este curso estão encerradas.
            </p>
          ) : (
            <Link
              className="button button-primary"
              href={`/inscricao?area=${encodeURIComponent(row.area)}&curso=${encodeURIComponent(row.name)}`}
            >
              Inscrever-me neste curso <Icon name="arrow_forward" />
            </Link>
          )}
          <Link className="text-link" href="/contactos">
            Tenho dúvidas <Icon name="help" />
          </Link>
        </aside>
      </div>
    </main>
  );
}
