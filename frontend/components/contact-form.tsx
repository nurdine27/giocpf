'use client';
import { useState } from 'react';
import { API_BASE } from '@/lib/api-url';
import { CONTACT_CATEGORIES } from '@/lib/constants';
import { Icon } from './icon';
import { Notice } from './public-ui';

export function ContactForm() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch(`${API_BASE}/contact-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof x.message === 'string' ? x.message : '');
      setMessage(x.message);
      form.reset();
    } catch (err) {
      setError(
        (err instanceof Error && err.message) || 'Não foi possível enviar agora. Tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card contact-form" onSubmit={submit}>
      <h2>Envie-nos uma mensagem</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="c-name">Nome completo *</label>
          <input
            id="c-name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
          />
        </div>
        <div className="field">
          <label htmlFor="c-email">E-mail *</label>
          <input id="c-email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="c-subject">Assunto *</label>
          <input id="c-subject" name="subject" required minLength={2} maxLength={180} />
        </div>
        <div className="field">
          <label htmlFor="c-category">Categoria *</label>
          <select id="c-category" name="category" required defaultValue="">
            <option value="" disabled>
              Seleccione
            </option>
            {CONTACT_CATEGORIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label htmlFor="c-body">Mensagem *</label>
          <textarea id="c-body" name="body" minLength={10} maxLength={10000} required />
        </div>
        <div className="field full">
          {message && <Notice>{message}</Notice>}
          {error && <Notice type="error">{error}</Notice>}
          <button className="button button-primary" disabled={busy}>
            {busy ? 'A enviar…' : 'Enviar mensagem'} <Icon name={busy ? 'hourglass_top' : 'send'} />
          </button>
        </div>
      </div>
    </form>
  );
}
