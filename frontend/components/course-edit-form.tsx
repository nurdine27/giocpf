'use client';
import { API_BASE } from '@/lib/api-url';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
const api = API_BASE;
type Course = {
  name: string;
  area: string;
  description: string;
  duration: string | null;
  requirements: string | null;
  published: boolean;
  enrollmentOpen: boolean;
};
export function CourseEditForm({ id }: { id: string }) {
  const router = useRouter();
  const [c, setC] = useState<Course | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`${api}/admin/courses/${id}`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/admin/login');
          return;
        }
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        setC(d);
      })
      .catch(() => setError('Não foi possível carregar o curso. Verifique a ligação e tente novamente.'));
  }, [id, router]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!c) return;
    setBusy(true);
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const data = {
      ...raw,
      published: raw.published === 'on',
      enrollmentOpen: raw.enrollmentOpen === 'on',
    };
    try {
      const r = await fetch(`${api}/admin/courses/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error('Não foi possível guardar as alterações.');
      router.push('/admin/cursos');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="conteudo" className="admin-shell">
      <div className="page-heading">
        <div className="section-kicker">GESTÃO DE CURSOS</div>
        <h1>Editar curso</h1>
      </div>
      <nav className="admin-nav">
        <Link href="/admin/cursos">← Voltar aos cursos</Link>
      </nav>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {c && (
        <form className="form-card" onSubmit={save}>
          <div className="form-grid">
            <div className="field">
              <label>
                Nome
                <input name="name" required defaultValue={c.name} />
              </label>
            </div>
            <div className="field">
              <label>
                Área
                <input name="area" required defaultValue={c.area} />
              </label>
            </div>
            <div className="field full">
              <label>
                Descrição
                <textarea name="description" defaultValue={c.description} />
              </label>
            </div>
            <div className="field">
              <label>
                Duração
                <input name="duration" defaultValue={c.duration ?? ''} />
              </label>
            </div>
            <div className="field">
              <label>
                Requisitos
                <input name="requirements" defaultValue={c.requirements ?? ''} />
              </label>
            </div>
            <div className="field full">
              <label className="check-field">
                <input name="published" type="checkbox" defaultChecked={c.published} /> Publicado no
                catálogo
              </label>
              <label className="check-field">
                <input name="enrollmentOpen" type="checkbox" defaultChecked={c.enrollmentOpen} />{' '}
                Inscrições abertas
              </label>
            </div>
            <button className="button button-primary" disabled={busy}>
              {busy ? 'A guardar…' : 'Guardar alterações'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
