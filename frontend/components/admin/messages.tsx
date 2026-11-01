'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '../icon';
import { useAdmin } from './admin-layout';
import { useConfirm, useToast } from './feedback';
import {
  Avatar,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  Skeleton,
  StatusBadge,
  Tabs,
  useResource,
  ActionMenu,
} from './ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { MESSAGE_STATUS, PAGE_SIZE } from '@/lib/constants';
import { formatDateTime, relativeTime } from '@/lib/format';

type Row = {
  id: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
  preview: string;
};
type ListResult = {
  data: Row[];
  meta: { page: number; total: number; totalPages: number };
  counts: Record<string, number>;
};
type Message = Row & {
  body: string;
  replies: {
    id: string;
    body: string;
    createdAt: string;
    admin: { email: string; displayName: string };
  }[];
  assignedAdmin: { email: string; displayName: string } | null;
};

export function MessageInbox() {
  const params = useSearchParams();
  const { refreshBadges } = useAdmin();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(params.get('abrir'));

  const list = useResource(() => {
    const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (q) qs.set('q', q);
    if (status) qs.set('status', status);
    return apiFetch<ListResult>(`/admin/contact-messages?${qs}`);
  }, [page, q, status]);

  const onSearch = useCallback((value: string) => {
    setPage(1);
    setQ(value);
  }, []);

  const onChanged = useCallback(() => {
    void list.reload();
    void refreshBadges();
  }, [list, refreshBadges]);

  const counts = list.data?.counts ?? {};
  const active =
    counts.NAO_LIDA + counts.LIDA + counts.EM_TRATAMENTO + counts.RESPONDIDA || undefined;

  return (
    <>
      <PageHeader
        title="Mensagens"
        description="Pedidos recebidos através do formulário «Fale connosco» do site."
      />
      <div className={`inbox ${openId ? 'has-open' : ''}`}>
        <Panel padded={false} className="inbox-list">
          <div className="toolbar toolbar-stack">
            <SearchField value={q} onChange={onSearch} placeholder="Nome, e-mail ou assunto" />
            <Tabs
              value={status}
              onChange={(v) => {
                setPage(1);
                setStatus(v);
              }}
              items={[
                { value: '', label: 'Activas', count: active },
                ...Object.entries(MESSAGE_STATUS).map(([value, m]) => ({
                  value,
                  label: m.label,
                  count: counts[value] || undefined,
                })),
              ]}
            />
          </div>
          {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
          {list.loading && !list.data && <Skeleton rows={6} height={64} />}
          {list.data && list.data.data.length === 0 && (
            <EmptyState
              icon="inbox"
              title="Caixa vazia"
              description="Não há mensagens com estes filtros."
            />
          )}
          <ul className="message-list">
            {list.data?.data.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className={`message-item ${m.status === 'NAO_LIDA' ? 'is-unread' : ''} ${openId === m.id ? 'is-active' : ''}`}
                  onClick={() => setOpenId(m.id)}
                >
                  <Avatar name={m.name} size={38} />
                  <span className="message-item-body">
                    <span className="message-item-top">
                      <strong>{m.name}</strong>
                      <small>{relativeTime(m.createdAt)}</small>
                    </span>
                    <span className="message-item-subject">{m.subject}</span>
                    <small className="message-item-preview">{m.preview}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {list.data && (
            <Pagination
              page={page}
              pages={list.data.meta.totalPages}
              total={list.data.meta.total}
              onChange={setPage}
            />
          )}
        </Panel>
        <div className="inbox-reader">
          {openId ? (
            <MessageReader
              key={openId}
              id={openId}
              onClose={() => setOpenId(null)}
              onChanged={onChanged}
            />
          ) : (
            <Panel>
              <EmptyState
                icon="mark_email_read"
                title="Seleccione uma mensagem"
                description="O conteúdo aparece aqui."
              />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function MessageReader({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = useAdmin();
  const { data, setData, error, loading, reload } = useResource(
    () => apiFetch<Message>(`/admin/contact-messages/${id}`),
    [id],
  );
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) onChanged();
    // Opening marks the message as read on the server; refresh list and badges once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  if (error)
    return (
      <Panel>
        <ErrorState message={error} onRetry={reload} />
      </Panel>
    );
  if (loading || !data)
    return (
      <Panel>
        <Skeleton rows={5} />
      </Panel>
    );

  async function setStatus(status: string) {
    if (status === 'ARQUIVADA') {
      const ok = await confirm({
        title: 'Arquivar mensagem?',
        message: 'Sai da caixa de entrada, mas pode ser consultada no filtro «Arquivada».',
        confirmLabel: 'Arquivar',
        tone: 'primary',
        icon: 'inventory_2',
      });
      if (!ok) return;
    }
    try {
      await apiFetch(`/admin/contact-messages/${id}/status`, { method: 'PATCH', body: { status } });
      setData((d) => d && { ...d, status });
      toast.success(`Mensagem marcada como «${MESSAGE_STATUS[status].label.toLowerCase()}».`);
      onChanged();
      if (status === 'ARQUIVADA') onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function remove() {
    const ok = await confirm({
      title: 'Eliminar mensagem?',
      message: 'A mensagem e as respostas serão eliminadas permanentemente.',
      confirmLabel: 'Eliminar',
      icon: 'delete_forever',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/contact-messages/${id}`, { method: 'DELETE' });
      toast.success('Mensagem eliminada.');
      onChanged();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const ok = await confirm({
      title: 'Enviar resposta?',
      message: (
        <>
          A resposta será enviada por e-mail para <strong>{data.email}</strong>.
        </>
      ),
      confirmLabel: 'Enviar',
      tone: 'primary',
      icon: 'send',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await apiFetch<{ emailSent: boolean }>(
        `/admin/contact-messages/${id}/replies`,
        {
          method: 'POST',
          body: { body: reply },
        },
      );
      if (result.emailSent) toast.success('Resposta enviada por e-mail.');
      else
        toast.warning(
          'Resposta guardada, mas o e-mail não foi enviado. Verifique a configuração de e-mail.',
        );
      setReply('');
      await reload();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const canManage = can('messages.manage');
  return (
    <Panel className="reader" padded={false}>
      <div className="reader-head">
        <button className="icon-btn reader-back" onClick={onClose} aria-label="Voltar à lista">
          <Icon name="arrow_back" />
        </button>
        <div>
          <span className="eyebrow-sm">{data.category}</span>
          <h2>{data.subject}</h2>
        </div>
        <StatusBadge meta={MESSAGE_STATUS[data.status]} />
        {canManage && (
          <span className="only-mobile">
            <ActionMenu
              label={data.subject}
              actions={[
                {
                  label: 'Responder por e-mail',
                  icon: 'mail',
                  onSelect: () => window.open(`mailto:${data.email}`, '_self'),
                },
                {
                  label: 'Em tratamento',
                  icon: 'pending',
                  hidden: data.status === 'EM_TRATAMENTO',
                  onSelect: () => setStatus('EM_TRATAMENTO'),
                },
                {
                  label: 'Marcar como não lida',
                  icon: 'mark_email_unread',
                  hidden: data.status === 'NAO_LIDA',
                  onSelect: () => setStatus('NAO_LIDA'),
                },
                {
                  label: 'Arquivar',
                  icon: 'inventory_2',
                  hidden: data.status === 'ARQUIVADA',
                  onSelect: () => setStatus('ARQUIVADA'),
                },
                { label: 'Eliminar', icon: 'delete', danger: true, onSelect: remove },
              ]}
            />
          </span>
        )}
      </div>
      <div className="reader-from">
        <Avatar name={data.name} size={40} />
        <div>
          <strong>{data.name}</strong>
          <a href={`mailto:${data.email}`}>{data.email}</a>
        </div>
        <small>{formatDateTime(data.createdAt)}</small>
      </div>
      {canManage && (
        <div className="reader-actions only-desktop">
          {data.status !== 'EM_TRATAMENTO' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setStatus('EM_TRATAMENTO')}>
              <Icon name="pending" /> Em tratamento
            </button>
          )}
          {data.status !== 'NAO_LIDA' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setStatus('NAO_LIDA')}>
              <Icon name="mark_email_unread" /> Marcar como não lida
            </button>
          )}
          {data.status !== 'ARQUIVADA' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setStatus('ARQUIVADA')}>
              <Icon name="inventory_2" /> Arquivar
            </button>
          )}
          <button className="btn btn-ghost btn-sm is-danger" onClick={remove}>
            <Icon name="delete" /> Eliminar
          </button>
        </div>
      )}
      <div className="reader-body">
        <p className="prose">{data.body}</p>
        {data.replies.map((r) => (
          <div key={r.id} className="reply-bubble">
            <small>
              <Icon name="reply" /> {r.admin.displayName || r.admin.email} ·{' '}
              {formatDateTime(r.createdAt)}
            </small>
            <p className="prose">{r.body}</p>
          </div>
        ))}
      </div>
      {can('messages.reply') && (
        <form className="reader-reply" onSubmit={send}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={`Responder a ${data.name}…`}
            rows={4}
            required
            maxLength={10000}
            aria-label="Resposta"
          />
          <button className="btn btn-primary" disabled={busy || !reply.trim()}>
            <Icon name="send" /> {busy ? 'A enviar…' : 'Enviar resposta'}
          </button>
        </form>
      )}
    </Panel>
  );
}
