'use client';
import { API_BASE } from '@/lib/api-url';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
const api = API_BASE;
type RecordData = {
  id: string;
  reference: string;
  name: string;
  phone: string;
  email: string | null;
  age: number | null;
  province: string;
  district: string;
  area: string;
  courseName: string;
  message: string | null;
  status: string;
  createdAt: string;
  notes: { id: string; body: string; createdAt: string }[];
};
export function RegistrationDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch(`${api}/admin/registrations/${id}`, { credentials: 'include' });
    if (r.status === 401) {
      router.replace('/admin/login');
      return;
    }
    const x = await r.json();
    if (!r.ok) throw new Error(x.message || 'Não foi possível carregar a inscrição.');
    setData(x);
  }
  useEffect(() => {
    let active = true;
    fetch(`${api}/admin/registrations/${id}`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/admin/login');
          return;
        }
        const result = await r.json();
        if (!r.ok) throw new Error(result.message || 'Não foi possível carregar a inscrição.');
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Erro ao carregar a inscrição.');
      });
    return () => {
      active = false;
    };
  }, [id, router]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    setBusy(true);
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    if (
      fields.status === 'RECUSADA' &&
      data.status !== 'RECUSADA' &&
      !window.confirm('Confirmar a recusa desta inscrição?')
    ) {
      setBusy(false);
      return;
    }
    try {
      const r = await fetch(`${api}/admin/registrations/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: fields.status, note: fields.note }),
      });
      if (!r.ok) throw new Error('Não foi possível actualizar a inscrição.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <main id="conteudo" className="admin-shell">
        <p role="alert" className="form-error">
          {error}
        </p>
        <Link href="/admin/inscricoes">Voltar à lista</Link>
      </main>
    );
  if (!data) return <main className="admin-shell">A carregar inscrição…</main>;
  return (
    <main id="conteudo" className="admin-shell">
      <div className="page-heading">
        <div className="section-kicker">INSCRIÇÃO {data.reference}</div>
        <h1>{data.name}</h1>
        <p>{new Date(data.createdAt).toLocaleString('pt-MZ')}</p>
      </div>
      <nav className="admin-nav">
        <Link href="/admin/inscricoes">← Voltar às inscrições</Link>
        <Link href="/admin">Painel</Link>
      </nav>
      <div className="contact-grid">
        <div className="contact-card">
          <strong>Contacto</strong>
          <p>
            <a href={`tel:${data.phone}`}>{data.phone}</a>
          </p>
          <p>{data.email || 'Sem e-mail'}</p>
        </div>
        <div className="contact-card">
          <strong>Formação</strong>
          <p>{data.courseName}</p>
          <p>{data.area}</p>
        </div>
        <div className="contact-card">
          <strong>Localização</strong>
          <p>
            {data.district}, {data.province}
          </p>
          <p>{data.age ? `${data.age} anos` : 'Idade não indicada'}</p>
        </div>
      </div>
      {data.message && (
        <article className="form-card">
          <h2>Mensagem</h2>
          <p>{data.message}</p>
        </article>
      )}
      <form className="form-card" onSubmit={save}>
        <h2>Actualizar inscrição</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="status">Estado</label>
            <select name="status" id="status" defaultValue={data.status}>
              {['PENDENTE', 'EM_ANALISE', 'ACEITE', 'RECUSADA'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="note">Nota interna</label>
            <textarea
              name="note"
              id="note"
              placeholder="Opcional. Apenas visível à equipa administrativa."
            />
          </div>
          <div className="field full">
            <button className="button button-primary" disabled={busy}>
              {busy ? 'A guardar…' : 'Guardar alterações'}
            </button>
            {error && <p className="form-error">{error}</p>}
          </div>
        </div>
      </form>
      <section className="form-card">
        <h2>Notas anteriores</h2>
        {data.notes.length ? (
          data.notes.map((n) => (
            <p className="mobile-row" key={n.id}>
              {n.body}
              <small>{new Date(n.createdAt).toLocaleString('pt-MZ')}</small>
            </p>
          ))
        ) : (
          <p className="page-muted">Ainda não existem notas.</p>
        )}
      </section>
    </main>
  );
}
