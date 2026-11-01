'use client';
import { API_BASE } from '@/lib/api-url';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { areas } from '@/lib/content';
import { Icon } from '@/components/icon';
import { EmptyNotice, PageIntro } from '@/components/public-ui';

type CatalogCourse = {
  name: string;
  slug: string;
  area: string;
  description?: string;
  duration?: string | null;
  imageUrl?: string | null;
  enrollmentOpen: boolean;
};

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const FALLBACK: CatalogCourse[] = areas.flatMap((a) =>
  a.courses.map((name) => ({ name, slug: slugify(name), area: a.name, enrollmentOpen: true })),
);

function Catalog() {
  const params = useSearchParams();
  const [query, setQuery] = useState('');
  const [area, setArea] = useState(params.get('area') ?? '');
  const [catalog, setCatalog] = useState<CatalogCourse[]>(FALLBACK);

  useEffect(() => {
    fetch(`${API_BASE}/courses`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: CatalogCourse[]) => rows.length && setCatalog(rows))
      .catch(() => undefined);
  }, []);

  const items = useMemo(
    () =>
      catalog.filter(
        (x) => (!area || x.area === area) && x.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [catalog, area, query],
  );
  const iconFor = (name: string) => areas.find((a) => a.name === name)?.icon ?? 'school';

  return (
    <main id="conteudo" className="page-wrap">
      <PageIntro
        title="Encontre a sua próxima formação"
        lede="Cursos práticos e profissionalizantes, organizados por área."
        crumbs={[{ href: '/cursos', label: 'Cursos' }]}
      />
      <div className="filter-bar">
        <div className="chip-row">
          <button
            type="button"
            className={!area ? 'chip is-active' : 'chip'}
            onClick={() => setArea('')}
          >
            Todas
          </button>
          {areas.map((a) => (
            <button
              key={a.name}
              type="button"
              className={area === a.name ? 'chip is-active' : 'chip'}
              onClick={() => setArea(a.name)}
            >
              <Icon name={a.icon} /> {a.name}
            </button>
          ))}
        </div>
        <label className="search-inline">
          <Icon name="search" />
          <input
            placeholder="Pesquisar curso"
            aria-label="Pesquisar curso"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <p className="page-muted" aria-live="polite">
        {items.length} {items.length === 1 ? 'curso encontrado' : 'cursos encontrados'}
      </p>
      {items.length ? (
        <div className="card-grid">
          {items.map((c) => (
            <article className="course-card" key={c.slug}>
              <Link href={`/cursos/${c.slug}`} className="course-card-media">
                {c.imageUrl ? (
                  <Image src={c.imageUrl} alt="" fill sizes="(max-width: 700px) 100vw, 33vw" />
                ) : (
                  <Icon name={iconFor(c.area)} />
                )}
              </Link>
              <div className="course-card-body">
                <span className="course-area">{c.area}</span>
                <h2>
                  <Link href={`/cursos/${c.slug}`}>{c.name}</Link>
                </h2>
                <div className="course-card-foot">
                  {c.enrollmentOpen ? (
                    <span className="status-pill tone-success">Inscrições abertas</span>
                  ) : (
                    <span className="status-pill tone-neutral">Inscrições encerradas</span>
                  )}
                  {c.duration && (
                    <span>
                      <Icon name="schedule" /> {c.duration}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyNotice
          icon="search_off"
          title="Nenhum curso encontrado"
          text="Experimente outra pesquisa ou área."
        />
      )}
    </main>
  );
}

export default function Courses() {
  return (
    <Suspense fallback={<main className="page-wrap">A carregar cursos…</main>}>
      <Catalog />
    </Suspense>
  );
}
