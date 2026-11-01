'use client';
import { API_BASE } from '@/lib/api-url';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Notice } from '@/components/public-ui';
export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recover, setRecover] = useState(false);
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState('');
  async function recoverSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form));
    const endpoint = sent ? 'password/reset' : 'password/forgot';
    try {
      const r = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!r.ok) throw new Error('Pedido não concluído. Verifique os dados e tente novamente.');
      if (sent) {
        setToast('Palavra-passe actualizada. Já pode iniciar sessão.');
        setTimeout(() => {
          setRecover(false);
          setSent(false);
        }, 1800);
      } else {
        setSent(true);
        setToast('Se o endereço estiver registado, receberá um código.');
      }
    } catch {
      setError(
        'Não foi possível concluir o pedido. Verifique os dados ou tente novamente mais tarde.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!r.ok) {
        const x = await r.json().catch(() => ({}));
        throw new Error(typeof x.message === 'string' ? x.message : '');
      }
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next && next.startsWith('/admin') ? next : '/admin');
    } catch (err) {
      setError(
        (err instanceof Error && err.message) ||
          'Não foi possível iniciar sessão. Verifique os dados e tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="conteudo" className="admin-login-page">
      <svg
        className="login-art"
        viewBox="0 0 900 700"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path
          d="M598 36C740 22 863 76 916 199c53 123 60 340-14 447-51 73-163 72-264 36-88-31-124-113-199-180-88-79-128-157-94-263C381 123 488 47 598 36Z"
          fill="#d8ef75"
        />
        <path
          d="M485 90c72-18 126 25 193 103 74 87 139 169 115 243-24 73-141 118-239 193-75 57-124 102-191 51-69-52-102-173-84-287C297 264 375 117 485 90Z"
          fill="#234d40"
        />
        <path
          d="M321 306c126-111 330-54 477 27"
          fill="none"
          stroke="#f8f8f3"
          strokeWidth="2"
          opacity=".7"
        />
        <path
          d="M553 624c79 61 108 53 158 12l174-149"
          fill="none"
          stroke="#a5bd56"
          strokeWidth="2"
        />
      </svg>
      <section className="login-card">
        <Image
          className="login-logo"
          src="/images/gio-logo2.png"
          alt="GIO CPF"
          width={76}
          height={76}
          priority
        />
        <h1>{recover ? 'Recuperar acesso' : 'Área Administrativa'}</h1>
        {recover ? (
          <form onSubmit={recoverSubmit}>
            <label className="login-field">
              <span className="material-symbols">mail</span>
              <input name="email" type="email" placeholder="E-mail" required autoComplete="email" />
            </label>
            {sent && (
              <>
                <label className="login-field">
                  <span className="material-symbols">key</span>
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    placeholder="Código de 6 dígitos"
                    required
                  />
                </label>
                <label className="login-field">
                  <span className="material-symbols">lock</span>
                  <input
                    name="password"
                    type="password"
                    placeholder="Nova palavra-passe"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </label>
              </>
            )}
            <button disabled={busy} className="button button-primary login-submit">
              {busy ? 'A processar…' : sent ? 'Redefinir palavra-passe' : 'Enviar código'}
            </button>
            <button
              type="button"
              className="login-back"
              onClick={() => {
                setRecover(false);
                setSent(false);
                setError('');
                setToast('');
              }}
            >
              Voltar ao login
            </button>
          </form>
        ) : (
          <form onSubmit={submit}>
            <label className="login-field">
              <span className="material-symbols">mail</span>
              <input
                name="email"
                type="email"
                placeholder="E-mail"
                required
                autoComplete="username"
              />
            </label>
            <label className="login-field">
              <span className="material-symbols">lock</span>
              <input
                name="password"
                type="password"
                placeholder="Palavra-passe"
                required
                minLength={8}
                autoComplete="current-password"
              />
            </label>
            <button disabled={busy} className="button button-primary login-submit">
              {busy ? 'A verificar…' : 'Entrar'}
            </button>
            <button
              type="button"
              className="login-back"
              onClick={() => {
                setRecover(true);
                setError('');
                setToast('');
              }}
            >
              Esqueceu a palavra-passe?
            </button>
          </form>
        )}
        {toast && <Notice>{toast}</Notice>}
        {error && <Notice type="error">{error}</Notice>}
      </section>
    </main>
  );
}
