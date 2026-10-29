'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
const api = process.env.NEXT_PUBLIC_API_URL;
type CourseRow = {
  id: string;
  name: string;
  area: string;
  published: boolean;
  enrollmentOpen: boolean;
};
export function AdminPanel() {
  const router = useRouter();
  const [data, setData] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`${api}/admin/dashboard`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/admin/login');
          return;
        }
        if (!r.ok) throw new Error('Não foi possível carregar o painel.');
        setData(await r.json());
      })
      .catch((e) => setError(e.message));
  }, [router]);
  async function logout() {
    await fetch(`${api}/auth/logout`, { method: 'POST', credentials: 'include' });
    router.replace('/admin/login');
  }
  return (
    <main id="conteudo" className="admin-shell">
      <div className="page-heading">
        <div className="section-kicker">ADMINISTRAÇÃO</div>
        <h1>Painel de gestão</h1>
        <p>Resumo actualizado das inscrições e cursos.</p>
      </div>
      <nav className="admin-nav">
        <Link href="/admin/inscricoes">Inscrições</Link>
        <Link href="/admin/cursos">Cursos</Link>
        <button className="button button-light" onClick={logout}>
          Terminar sessão
        </button>
      </nav>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {!data ? (
        <p>A carregar…</p>
      ) : (
        <div className="admin-stats">
          {[
            ['Inscrições', data.total],
            ['Pendentes', data.pending],
            ['Em análise', data.review],
            ['Aceites', data.accepted],
            ['Recusadas', data.rejected],
            ['Cursos', data.courses],
          ].map(([k, v]) => (
            <div className="admin-stat" key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
export function RegistrationAdmin() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');
  const router = useRouter();
  useEffect(() => {
    const u = new URL(`${api}/registrations`);
    u.searchParams.set('page', String(page));
    if (q) u.searchParams.set('q', q);
    if (status) u.searchParams.set('status', status);
    fetch(u, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/admin/login');
          return;
        }
        const x = await r.json();
        setRows(x.items ?? []);
      })
      .catch((e) => setErr(e.message));
  }, [q, status, page, router]);
  async function change(id: string, next: string) {
    if (next === 'RECUSADA' && !window.confirm('Confirmar a recusa desta inscrição?')) return;
    const r = await fetch(`${api}/admin/registrations/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (r.ok) setRows((old) => old.map((x) => (x.id === id ? { ...x, status: next } : x)));
    else setErr('Não foi possível actualizar o estado.');
  }
  return (
    <main id="conteudo" className="admin-shell">
      <div className="page-heading">
        <div className="section-kicker">GESTÃO</div>
        <h1>Inscrições</h1>
      </div>
      <nav className="admin-nav">
        <Link href="/admin">Resumo</Link>
        <Link href="/admin/cursos">Cursos</Link>
      </nav>
      <div className="course-toolbar">
        <label className="field">
          Pesquisar nome ou referência
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </label>
        <label className="field">
          Estado
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">Todos</option>
            {['PENDENTE', 'EM_ANALISE', 'ACEITE', 'RECUSADA'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {err && (
        <p role="alert" className="form-error">
          {err}
        </p>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Nome</th>
              <th>Curso</th>
              <th>Estado</th>
              <th>Acção</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id}>
                <td>
                  <Link href={`/admin/inscricoes/${x.id}`}>{x.reference}</Link>
                </td>
                <td>{x.name}</td>
                <td>{x.courseName}</td>
                <td>{x.status}</td>
                <td>
                  <select
                    aria-label={`Alterar estado de ${x.reference}`}
                    value={x.status}
                    onChange={(e) => change(x.id, e.target.value)}
                  >
                    {['PENDENTE', 'EM_ANALISE', 'ACEITE', 'RECUSADA'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-cards">
        {rows.map((x) => (
          <article className="mobile-row" key={x.id}>
            <strong>{x.name}</strong>
            <Link href={`/admin/inscricoes/${x.id}`}>
              {x.reference} · {x.courseName}
            </Link>
            <label>
              Estado
              <select value={x.status} onChange={(e) => change(x.id, e.target.value)}>
                {['PENDENTE', 'EM_ANALISE', 'ACEITE', 'RECUSADA'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </div>
      <div className="admin-nav">
        <button
          className="button button-light"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </button>
        <span>Página {page}</span>
        <button
          className="button button-light"
          disabled={rows.length < 20}
          onClick={() => setPage(page + 1)}
        >
          Seguinte
        </button>
      </div>
    </main>
  );
}
export function CourseAdmin() {
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const apiUrl = api;
  async function load() {
    const r = await fetch(`${apiUrl}/admin/courses`, { credentials: 'include' });
    if (r.status === 401) {
      router.replace('/admin/login');
      return;
    }
    if (r.ok) setRows(await r.json());
  }
  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/admin/courses`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/admin/login');
          return;
        }
        if (!r.ok) throw new Error('Não foi possível carregar os cursos.');
        const courses: CourseRow[] = await r.json();
        if (active) setRows(courses);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Erro ao carregar os cursos.');
      });
    return () => {
      active = false;
    };
  }, [apiUrl, router]);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch(`${apiUrl}/admin/courses`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!r.ok) throw new Error('Não foi possível criar o curso.');
      e.currentTarget.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }
  async function toggle(id: string, key: string, val: boolean) {
    if (key === 'published' && val && !window.confirm('Despublicar este curso?')) return;
    const r = await fetch(`${apiUrl}/admin/courses/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: !val }),
    });
    if (!r.ok) {
      setError('Não foi possível actualizar o curso.');
      return;
    }
    await load();
  }
  return (
    <main id="conteudo" className="admin-shell">
      <div className="page-heading">
        <div className="section-kicker">GESTÃO</div>
        <h1>Cursos</h1>
      </div>
      <nav className="admin-nav">
        <Link href="/admin">Resumo</Link>
        <Link href="/admin/inscricoes">Inscrições</Link>
      </nav>
      <form className="form-card" onSubmit={create}>
        <h2>Novo curso</h2>
        <div className="form-grid">
          <div className="field">
            <label>
              Nome
              <input name="name" required minLength={3} />
            </label>
          </div>
          <div className="field">
            <label>
              Área
              <input name="area" required />
            </label>
          </div>
          <div className="field full">
            <label>
              Descrição
              <textarea name="description" />
            </label>
          </div>
          <div className="field">
            <label>
              Duração (se conhecida)
              <input name="duration" />
            </label>
          </div>
          <div className="field">
            <label>
              Requisitos (se conhecidos)
              <input name="requirements" />
            </label>
          </div>
          <div className="field full">
            <label className="check-field">
              <input name="published" type="checkbox" value="true" /> Publicar curso
            </label>
            <label className="check-field">
              <input name="enrollmentOpen" type="checkbox" value="true" /> Abrir inscrições
            </label>
          </div>
          <button className="button button-primary" disabled={busy}>
            Criar curso
          </button>
        </div>
      </form>
      {error && <p className="form-error">{error}</p>}
      <h2>Cursos existentes</h2>
      <div className="mobile-cards">
        {rows.map((c) => (
          <article className="mobile-row" key={c.id}>
            <strong>
              <Link href={`/admin/cursos/${c.id}`}>{c.name}</Link>
            </strong>
            <span>
              {c.area} · {c.published ? 'Publicado' : 'Rascunho'}
            </span>
            <div className="mobile-row-actions">
              <button
                className="button button-light"
                onClick={() => toggle(c.id, 'published', c.published)}
              >
                {c.published ? 'Despublicar' : 'Publicar'}
              </button>
              <button
                className="button button-light"
                onClick={() => toggle(c.id, 'enrollmentOpen', c.enrollmentOpen)}
              >
                {c.enrollmentOpen ? 'Fechar inscrições' : 'Abrir inscrições'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
