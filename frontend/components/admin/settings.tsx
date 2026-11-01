'use client';
import { useState } from 'react';
import { Icon } from '../icon';
import { useToast } from './feedback';
import { ImageUpload, type ImageValue } from './image-upload';
import { ErrorState, Field, PageHeader, Panel, Skeleton, useResource } from './ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { SITE } from '@/lib/site';

type Settings = Record<string, string>;

const SECTIONS: {
  title: string;
  icon: string;
  fields: { key: string; label: string; type?: string; hint?: string; placeholder?: string }[];
}[] = [
  {
    title: 'Identidade',
    icon: 'apartment',
    fields: [
      { key: 'institutionName', label: 'Nome da instituição', placeholder: SITE.name },
      { key: 'address', label: 'Endereço', placeholder: 'Rua, bairro, cidade' },
    ],
  },
  {
    title: 'Contactos',
    icon: 'contact_phone',
    fields: [
      {
        key: 'institutionEmail',
        label: 'E-mail institucional',
        type: 'email',
        hint: 'Recebe as notificações de novas mensagens.',
        placeholder: SITE.email,
      },
      { key: 'phone', label: 'Telefone', type: 'tel', placeholder: SITE.phone },
      {
        key: 'whatsapp',
        label: 'WhatsApp',
        type: 'tel',
        hint: 'Apenas dígitos, com indicativo (ex.: 258867268483).',
        placeholder: SITE.whatsapp,
      },
    ],
  },
  {
    title: 'Presença online',
    icon: 'public',
    fields: [
      { key: 'website', label: 'Website', type: 'url', placeholder: 'https://' },
      { key: 'facebook', label: 'Facebook', type: 'url', placeholder: SITE.facebook },
      { key: 'instagram', label: 'Instagram', type: 'url', placeholder: SITE.instagram },
    ],
  },
];

export function AdminSettings() {
  const { data, error, loading, reload } = useResource(
    () => apiFetch<Settings>('/admin/institution-settings'),
    [],
  );
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Dados institucionais apresentados no site e usados nas notificações."
      />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={3} height={160} />}
      <EmailPanel />
      {data && <SettingsForm key={JSON.stringify(data)} data={data} onSaved={reload} />}
    </>
  );
}

function SettingsForm({ data, onSaved }: { data: Settings; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [values, setValues] = useState<Settings>(data);
  const [busy, setBusy] = useState(false);
  const dirty = Object.keys({ ...data, ...values }).some(
    (k) => (data[k] ?? '') !== (values[k] ?? ''),
  );
  const logo: ImageValue | null = values.logoUrl
    ? { url: values.logoUrl, publicId: values.logoPublicId }
    : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/admin/institution-settings', { method: 'PATCH', body: { values } });
      await onSaved();
      toast.success('As alterações já estão visíveis no site.', 'Configurações guardadas');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="settings-layout">
      <Panel title="Logótipo" icon="image">
        <ImageUpload
          value={logo}
          onChange={(v) =>
            setValues((s) => ({ ...s, logoUrl: v?.url ?? '', logoPublicId: v?.publicId ?? '' }))
          }
          folder="instituicao"
          shape="square"
          label="Carregar logótipo"
        />
      </Panel>
      {SECTIONS.map((section) => (
        <Panel key={section.title} title={section.title} icon={section.icon}>
          <div className="form-grid-2">
            {section.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <input
                  type={f.type ?? 'text'}
                  value={values[f.key] ?? ''}
                  placeholder={f.placeholder}
                  maxLength={500}
                  onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
        </Panel>
      ))}
      <div className={`save-bar ${dirty ? 'is-visible' : ''}`}>
        <span>
          <Icon name="info" /> Tem alterações por guardar.
        </span>
        <button type="button" className="btn btn-ghost" onClick={() => setValues(data)}>
          Descartar
        </button>
        <button className="btn btn-primary" disabled={busy || !dirty}>
          <Icon name="save" /> {busy ? 'A guardar…' : 'Guardar alterações'}
        </button>
      </div>
    </form>
  );
}

type EmailStatus = {
  provider: 'resend' | 'smtp' | null;
  from: string | null;
  replyTo: string | null;
  notificationsTo: string | null;
};

const PROVIDER_LABEL = { resend: 'Resend', smtp: 'SMTP' } as const;

function EmailPanel() {
  const toast = useToast();
  const { data } = useResource(
    () => apiFetch<EmailStatus>('/admin/institution-settings/email'),
    [],
  );
  const [busy, setBusy] = useState(false);

  async function sendTest() {
    setBusy(true);
    try {
      const result = await apiFetch<{ to: string }>('/admin/institution-settings/email/test', {
        method: 'POST',
      });
      toast.success(`Verifique a caixa de ${result.to}.`, 'E-mail de teste enviado');
    } catch (e) {
      toast.error(errorMessage(e), 'Falha no envio');
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const active = data.provider !== null;
  return (
    <Panel
      title="Envio de e-mail"
      icon="mail"
      className="email-panel"
      actions={
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={sendTest}
          disabled={!active || busy}
        >
          <Icon name="send" /> {busy ? 'A enviar…' : 'Enviar teste'}
        </button>
      }
    >
      <dl className="info-list">
        <div>
          <dt>
            <Icon name="dns" /> Serviço
          </dt>
          <dd>
            {active ? (
              <span className="badge tone-success">
                <Icon name="check_circle" /> {PROVIDER_LABEL[data.provider!]}
              </span>
            ) : (
              <span className="badge tone-warning">
                <Icon name="warning" /> Indisponível
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="outgoing_mail" /> Remetente
          </dt>
          <dd>
            {data.from?.includes('TEU-DOMINIO-VALIDADO') ? 'A configurar' : data.from ?? '—'}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="notifications" /> Avisos enviados para
          </dt>
          <dd>{data.notificationsTo ?? '—'}</dd>
        </div>
        <div>
          <dt>
            <Icon name="reply" /> Responder para
          </dt>
          <dd>{data.replyTo ?? data.notificationsTo ?? '—'}</dd>
        </div>
      </dl>
      {!active && (
        <p className="muted-text email-hint">
          O envio de e-mails ainda não está disponível. As mensagens recebidas continuam guardadas
          no painel. Contacte o suporte técnico para activar as notificações por e-mail.
        </p>
      )}
    </Panel>
  );
}
