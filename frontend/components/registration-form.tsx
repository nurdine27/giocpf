'use client';
import { API_BASE } from '@/lib/api-url';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { areas, provinces } from '@/lib/content';
import { Icon } from '@/components/icon';
export function RegistrationForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [area, setArea] = useState(params.get('area') ?? '');
  const [province, setProvince] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');
  const [course, setCourse] = useState(params.get('curso') ?? '');
  const [submissionKey] = useState(() => crypto.randomUUID());
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
  const courses = useMemo(
    () => catalog.filter((c) => c.area === area).map((c) => c.course),
    [catalog, area],
  );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = { ...Object.fromEntries(new FormData(e.currentTarget).entries()), submissionKey };
    try {
      const r = await fetch(`${API_BASE}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await r.json();
      if (!r.ok)
        throw new Error(
          Array.isArray(result.message)
            ? result.message[0]
            : result.message || 'Não foi possível enviar a inscrição.',
        );
      setReference(result.reference);
      router.push(`/inscricao/sucesso?referencia=${encodeURIComponent(result.reference)}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'O serviço de inscrições não está disponível neste momento.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (reference)
    return (
      <div className="form-success" role="status">
        <h2>Inscrição recebida</h2>
        <p>
          A gravação foi concluída. Guarde esta referência: <strong>{reference}</strong>.
        </p>
        <p>A equipa do GIO entrará em contacto para confirmar a turma e os próximos passos.</p>
        <Link className="text-link" href="/">
          Voltar ao início <Icon name="arrow_forward" />
        </Link>
      </div>
    );
  return (
    <form className="form-card" onSubmit={submit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Nome completo *</label>
          <input id="name" name="name" autoComplete="name" required minLength={3} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="phone">Telefone / WhatsApp *</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            minLength={8}
            maxLength={24}
            placeholder="+258"
          />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail (opcional)</label>
          <input id="email" name="email" type="email" autoComplete="email" maxLength={254} />
        </div>
        <div className="field">
          <label htmlFor="age">Idade (opcional)</label>
          <input id="age" name="age" type="number" min="14" max="99" />
        </div>
        <div className="field">
          <label htmlFor="province">Província *</label>
          <select
            id="province"
            name="province"
            required
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          >
            <option value="">Seleccione a província</option>
            {Object.keys(provinces)
              .sort()
              .map((p) => (
                <option key={p}>{p}</option>
              ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="district">Distrito *</label>
          <select id="district" name="district" required disabled={!province}>
            <option value="">
              {province ? 'Seleccione o distrito' : 'Seleccione primeiro a província'}
            </option>
            {(provinces[province] ?? []).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="area">Área de formação *</label>
          <select
            id="area"
            name="area"
            required
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            <option value="">Seleccione a área</option>
            {areas.map((a) => (
              <option key={a.name}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="course">Curso *</label>
          <select
            id="course"
            name="course"
            required
            disabled={!area}
            value={courses.includes(course) ? course : ''}
            onChange={(e) => setCourse(e.target.value)}
          >
            <option value="">{area ? 'Seleccione o curso' : 'Seleccione primeiro a área'}</option>
            {courses.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label htmlFor="message">Mensagem (opcional)</label>
          <textarea id="message" name="message" maxLength={1000} />
        </div>
        <div className="field full">
          <label className="check-field">
            <input name="consent" type="checkbox" value="true" required />
            <span>
              Autorizo o GIO Centro de Formação a contactar-me sobre esta inscrição, conforme a{' '}
              <Link href="/politica-de-privacidade">Política de Privacidade</Link>. *
            </span>
          </label>
        </div>
        <div className="field full">
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? 'A enviar…' : 'Enviar inscrição'}{' '}
            <Icon name={busy ? 'hourglass_top' : 'arrow_forward'} />
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <p className="page-muted">Os campos assinalados com * são obrigatórios.</p>
        </div>
      </div>
    </form>
  );
}
