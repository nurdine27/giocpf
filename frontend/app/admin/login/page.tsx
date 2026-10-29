'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      const x = await r.json();
      if (!r.ok) throw new Error(x.message || 'Não foi possível iniciar sessão.');
      router.push('/admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de ligação.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="conteudo" className="page-wrap">
      <div className="page-heading">
        <div className="section-kicker">ACESSO RESTRITO</div>
        <h1>Painel administrativo</h1>
        <p>Inicie sessão com a sua conta de administrador.</p>
      </div>
      <form className="form-card" onSubmit={submit}>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" required autoComplete="username" />
          </div>
          <div className="field full">
            <label htmlFor="password">Palavra-passe</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="current-password"
            />
          </div>
          <div className="field full">
            <button disabled={busy} className="button button-primary">
              {busy ? 'A verificar…' : 'Entrar'}
            </button>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
          </div>
        </div>
      </form>
    </main>
  );
}
