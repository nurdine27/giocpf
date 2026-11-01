'use client';
import { API_BASE } from '@/lib/api-url';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { areas } from '@/lib/content';
import { Icon } from '@/components/icon';
function Catalog() {
  const params = useSearchParams();
  const [query, setQuery] = useState('');
  const [area, setArea] = useState(params.get('area') ?? '');
  const [catalog, setCatalog] = useState(
    areas.flatMap((a) => a.courses.map((course) => ({ course, area: a.name }))),
  );
  useEffect(() => {
    fetch(`${API_BASE}/courses`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { name: string; area: string }[]) => {
        if (rows.length) setCatalog(rows.map((r) => ({ course: r.name, area: r.area })));
      })
      .catch(() => undefined);
  }, []);
  const items = useMemo(
    () =>
      catalog.filter(
        (x) => (!area || x.area === area) && x.course.toLowerCase().includes(query.toLowerCase()),
      ),
    [catalog, area, query],
  );
  const availableAreas = [...new Set(catalog.map((x) => x.area))];
  return (
    <main id="conteudo" className="page-wrap">
      <div className="page-heading">
        <div className="section-kicker">FORMAÇÃO GIO</div>
        <h1>Encontre a sua próxima formação.</h1>
        <p>Cursos práticos e profissionalizantes organizados por área.</p>
      </div>
      <div className="course-toolbar">
        <label className="field">
          Pesquisar curso
          <input
            placeholder="Ex.: Marketing Digital"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="field">
          Filtrar por área
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Todas as áreas</option>
            {availableAreas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="page-muted" aria-live="polite">
        {items.length} {items.length === 1 ? 'curso encontrado' : 'cursos encontrados'}
      </p>
      <div className="course-results">
        {items.map((x) => (
          <article className="course-card" key={x.course}>
            <span className="course-area">{x.area}</span>
            <h2>{x.course}</h2>
            <p>Consulte a secretaria para confirmar os requisitos, horário e próxima turma.</p>
            <Link
              href={`/cursos/${encodeURIComponent(
                x.course
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/(^-|-$)/g, ''),
              )}`}
              className="text-link"
            >
              Detalhes do curso <Icon name="arrow_forward" />
            </Link>
            <Link
              href={`/inscricao?area=${encodeURIComponent(x.area)}&curso=${encodeURIComponent(x.course)}`}
              className="text-link"
            >
              Inscrever-me
            </Link>
          </article>
        ))}
      </div>
      {items.length === 0 && (
        <p className="form-card">
          Não encontrámos cursos com estes critérios. Experimente outra pesquisa.
        </p>
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
