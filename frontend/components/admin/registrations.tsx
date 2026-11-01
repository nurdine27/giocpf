'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '../icon';
import { useAdmin } from './admin-layout';
import { useConfirm, useToast } from './feedback';
import {
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  Skeleton,
  StatusBadge,
  Tabs,
  useResource,
  Avatar,
  CardList,
  ListCard,
} from './ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { PAGE_SIZE, REGISTRATION_STATUS, SHIFTS, WAITLIST } from '@/lib/constants';
import { formatDate, formatDateTime, relativeTime } from '@/lib/format';

type Row = {
  id: string;
  reference: string;
  name: string;
  phone: string;
  courseName: string;
  province: string;
  status: string;
  waitlisted: boolean;
  createdAt: string;
  campus: { name: string } | null;
  classGroup: { id: string; code: string; name: string } | null;
};
type ListResult = { data: Row[]; meta: { page: number; total: number; totalPages: number } };

/** Asks for confirmation when the new status is final (accepted or rejected). */
function useStatusChange() {
  const confirm = useConfirm();
  return useCallback(
    async (name: string, status: string) => {
      if (status !== 'RECUSADA' && status !== 'ACEITE') return true;
      const rejecting = status === 'RECUSADA';
      return confirm({
        title: rejecting ? 'Recusar inscrição?' : 'Aceitar inscrição?',
        message: (
          <>
            A inscrição de <strong>{name}</strong> passará a{' '}
            <strong>{REGISTRATION_STATUS[status].label.toLowerCase()}</strong>.
          </>
        ),
        confirmLabel: rejecting ? 'Recusar' : 'Aceitar',
        tone: rejecting ? 'danger' : 'primary',
        icon: REGISTRATION_STATUS[status].icon,
      });
    },
    [confirm],
  );
}

export function RegistrationList() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { can, refreshBadges } = useAdmin();
  const confirmStatus = useStatusChange();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [campusId, setCampusId] = useState('');
  const [waitlisted, setWaitlisted] = useState(params.get('espera') === '1');
  const [q, setQ] = useState('');
  const campuses = useResource(
    () => apiFetch<{ campuses: { id: string; name: string }[] }>('/registrations/form-options'),
    [],
  );
  const [page, setPage] = useState(1);
  const canManage = can('registrations.manage');

  const { data, setData, error, loading, reload } = useResource(() => {
    const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (q) qs.set('q', q);
    if (status) qs.set('status', status);
    if (campusId) qs.set('campusId', campusId);
    if (waitlisted) qs.set('waitlisted', 'true');
    return apiFetch<ListResult>(`/admin/registrations?${qs}`);
  }, [page, q, status, campusId, waitlisted]);

  const onSearch = useCallback((value: string) => {
    setPage(1);
    setQ(value);
  }, []);

  async function change(row: Row, next: string) {
    if (!(await confirmStatus(row.name, next))) return;
    try {
      await apiFetch(`/admin/registrations/${row.id}`, { method: 'PATCH', body: { status: next } });
      setData(
        (d) =>
          d && { ...d, data: d.data.map((x) => (x.id === row.id ? { ...x, status: next } : x)) },
      );
      toast.success(
        `${row.name}: ${REGISTRATION_STATUS[next].label.toLowerCase()}.`,
        'Estado actualizado',
      );
      void refreshBadges();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Inscrições"
        description="Candidaturas recebidas pelo formulário público. Clique numa linha para ver os detalhes."
      />
      <Panel padded={false}>
        <div className="toolbar">
          <Tabs
            value={status}
            onChange={(v) => {
              setPage(1);
              setStatus(v);
            }}
            items={[
              { value: '', label: 'Todas' },
              ...Object.entries(REGISTRATION_STATUS).map(([value, m]) => ({
                value,
                label: m.label,
                icon: m.icon,
              })),
            ]}
          />
          <div className="filter-selects">
            <select
              value={campusId}
              onChange={(e) => {
                setPage(1);
                setCampusId(e.target.value);
              }}
              aria-label="Pólo"
            >
              <option value="">Todos os pólos</option>
              {campuses.data?.campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`btn btn-sm ${waitlisted ? 'btn-primary' : 'btn-ghost'}`}
              aria-pressed={waitlisted}
              onClick={() => {
                setPage(1);
                setWaitlisted(!waitlisted);
              }}
            >
              <Icon name="schedule" /> Lista de espera
            </button>
            <SearchField value={q} onChange={onSearch} placeholder="Nome, referência ou telefone" />
          </div>
        </div>
        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data && <Skeleton rows={6} />}
        {data && data.data.length === 0 && (
          <EmptyState
            icon="assignment"
            title="Nenhuma inscrição encontrada"
            description="Ajuste a pesquisa ou o filtro de estado."
          />
        )}
        {data && data.data.length > 0 && (
          <>
            <div className={`table-wrap only-desktop ${loading ? 'is-loading' : ''}`}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Candidato</th>
                    <th>Curso e turma</th>
                    <th className="hide-sm">Pólo</th>
                    <th className="hide-sm">Data</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row) => (
                    <tr
                      key={row.id}
                      className="is-clickable"
                      onClick={() => router.push(`/admin/inscricoes/${row.id}`)}
                    >
                      <td>
                        <Link
                          href={`/admin/inscricoes/${row.id}`}
                          className="cell-title"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.name}
                        </Link>
                        <small className="cell-sub">
                          {row.reference} · {row.phone}
                        </small>
                      </td>
                      <td>
                        {row.courseName}
                        <small className="cell-sub">
                          {row.classGroup ? (
                            row.classGroup.code
                          ) : row.waitlisted ? (
                            <span className="text-warning">Lista de espera</span>
                          ) : (
                            'Sem turma'
                          )}
                        </small>
                      </td>
                      <td className="hide-sm">{row.campus?.name ?? '—'}</td>
                      <td className="hide-sm" title={formatDateTime(row.createdAt)}>
                        {relativeTime(row.createdAt)}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {canManage ? (
                          <select
                            className={`status-select tone-${REGISTRATION_STATUS[row.status]?.tone}`}
                            value={row.status}
                            aria-label={`Estado de ${row.name}`}
                            onChange={(e) => change(row, e.target.value)}
                          >
                            {Object.entries(REGISTRATION_STATUS).map(([value, m]) => (
                              <option key={value} value={value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <StatusBadge meta={REGISTRATION_STATUS[row.status]} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardList>
              {data.data.map((row) => (
                <ListCard
                  key={row.id}
                  onOpen={() => router.push(`/admin/inscricoes/${row.id}`)}
                  media={<Avatar name={row.name} size={42} />}
                  title={row.name}
                  subtitle={`${row.courseName} · ${row.campus?.name ?? ''} · ${relativeTime(row.createdAt)}`}
                  meta={
                    <>
                      <StatusBadge meta={REGISTRATION_STATUS[row.status]} />
                      {row.waitlisted && <StatusBadge meta={WAITLIST} />}
                      {row.classGroup && <span>{row.classGroup.code}</span>}
                    </>
                  }
                  actions={[
                    {
                      label: 'Ver detalhes',
                      icon: 'visibility',
                      onSelect: () => router.push(`/admin/inscricoes/${row.id}`),
                    },
                    {
                      label: 'Ligar',
                      icon: 'call',
                      onSelect: () => window.open(`tel:${row.phone}`, '_self'),
                    },
                    {
                      label: 'Abrir WhatsApp',
                      icon: 'chat',
                      onSelect: () =>
                        window.open(`https://wa.me/${row.phone.replace(/\D/g, '')}`, '_blank'),
                    },
                    ...Object.entries(REGISTRATION_STATUS)
                      .filter(([value]) => value !== row.status)
                      .map(([value, m]) => ({
                        label: `Marcar como ${m.label.toLowerCase()}`,
                        icon: m.icon,
                        danger: value === 'RECUSADA',
                        hidden: !canManage,
                        onSelect: () => change(row, value),
                      })),
                  ]}
                />
              ))}
            </CardList>
          </>
        )}
        {data && (
          <Pagination
            page={page}
            pages={data.meta.totalPages}
            total={data.meta.total}
            onChange={setPage}
          />
        )}
      </Panel>
    </>
  );
}

type ClassOption = {
  id: string;
  name: string;
  shift: string;
  campus: { id: string; name: string };
  period: { name: string; startsAt: string };
  capacity: number;
  seatsLeft: number;
};
type Detail = Row & {
  email: string | null;
  age: number | null;
  birthDate: string | null;
  gender: string | null;
  documentType: string | null;
  documentNumber: string | null;
  educationLevel: string | null;
  occupation: string | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  referralSource: string | null;
  district: string;
  area: string;
  message: string | null;
  campus: { id: string; name: string } | null;
  classGroup:
    | (ClassOption & {
        code: string;
        schedule: string;
        period: { name: string; startsAt: string; endsAt: string | null };
      })
    | null;
  classOptions: ClassOption[];
  updatedAt: string;
  notes: { id: string; body: string; createdAt: string; author: string }[];
};

export function RegistrationDetail({ id }: { id: string }) {
  const toast = useToast();
  const { can, refreshBadges } = useAdmin();
  const confirmStatus = useStatusChange();
  const { data, error, loading, reload } = useResource(
    () => apiFetch<Detail>(`/admin/registrations/${id}`),
    [id],
  );
  const [status, setStatus] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const back = (
    <Link href="/admin/inscricoes" className="back-link">
      <Icon name="arrow_back" /> Inscrições
    </Link>
  );
  if (error)
    return (
      <>
        <PageHeader title="Inscrição" back={back} />
        <ErrorState message={error} onRetry={reload} />
      </>
    );
  if (loading && !data) return <Skeleton rows={4} height={110} />;
  if (!data) return null;
  const nextStatus = status ?? data.status;
  const currentClass = data.classGroup?.id ?? '';
  const nextClass = classId ?? currentClass;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    if (nextStatus !== data.status && !(await confirmStatus(data.name, nextStatus))) return;
    if (nextStatus === data.status && nextClass === currentClass && !note.trim()) {
      toast.info('Altere o estado, a turma ou escreva uma nota.');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/admin/registrations/${id}`, {
        method: 'PATCH',
        body: {
          status: nextStatus,
          note,
          ...(nextClass !== currentClass ? { classId: nextClass } : {}),
        },
      });
      toast.success(
        note.trim() ? 'Nota guardada e inscrição actualizada.' : 'Inscrição actualizada.',
      );
      setNote('');
      setStatus(null);
      setClassId(null);
      await reload();
      void refreshBadges();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const info: [string, string, React.ReactNode][] = [
    [
      'call',
      'Telefone',
      <a key="t" href={`tel:${data.phone}`}>
        {data.phone}
      </a>,
    ],
    [
      'chat',
      'WhatsApp',
      <a
        key="w"
        href={`https://wa.me/${data.phone.replace(/\D/g, '')}`}
        target="_blank"
        rel="noreferrer"
      >
        Abrir conversa
      </a>,
    ],
    [
      'mail',
      'E-mail',
      data.email ? (
        <a key="e" href={`mailto:${data.email}`}>
          {data.email}
        </a>
      ) : (
        'Não indicado'
      ),
    ],
    [
      'cake',
      'Data de nascimento',
      data.birthDate
        ? `${formatDate(data.birthDate)} (${data.age} anos)`
        : data.age
          ? `${data.age} anos`
          : 'Não indicada',
    ],
    ['wc', 'Género', data.gender ?? '—'],
    [
      'badge',
      'Documento',
      data.documentNumber ? `${data.documentType ?? ''} ${data.documentNumber}`.trim() : '—',
    ],
    ['history_edu', 'Escolaridade', data.educationLevel ?? '—'],
    ['work', 'Ocupação', data.occupation ?? '—'],
    [
      'location_on',
      'Residência',
      [data.address, data.district, data.province].filter(Boolean).join(', '),
    ],
    [
      'emergency',
      'Contacto de emergência',
      data.emergencyName || data.emergencyPhone
        ? [data.emergencyName, data.emergencyPhone].filter(Boolean).join(' · ')
        : '—',
    ],
    ['campaign', 'Como soube do GIO', data.referralSource ?? '—'],
    ['calendar_today', 'Submetida em', formatDateTime(data.createdAt)],
  ];

  return (
    <>
      <PageHeader
        back={back}
        title={data.name}
        description={
          <>
            Referência <strong>{data.reference}</strong> · actualizada{' '}
            {relativeTime(data.updatedAt)}
          </>
        }
        actions={<StatusBadge meta={REGISTRATION_STATUS[data.status]} />}
      />
      <div className="detail-grid">
        <div className="detail-main">
          <Panel title="Dados do candidato" icon="badge">
            <dl className="info-list">
              {info.map(([icon, label, value]) => (
                <div key={label}>
                  <dt>
                    <Icon name={icon} /> {label}
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Formação" icon="school">
            <dl className="info-list">
              <div>
                <dt>
                  <Icon name="school" /> Curso
                </dt>
                <dd>
                  {data.courseName}
                  <small className="cell-sub">{data.area}</small>
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="location_city" /> Pólo
                </dt>
                <dd>{data.campus?.name ?? '—'}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="groups" /> Turma
                </dt>
                <dd>
                  {data.classGroup ? (
                    <>
                      {data.classGroup.code} · {SHIFTS[data.classGroup.shift]}
                      {data.classGroup.schedule && (
                        <small className="cell-sub">{data.classGroup.schedule}</small>
                      )}
                    </>
                  ) : data.waitlisted ? (
                    <StatusBadge meta={WAITLIST} />
                  ) : (
                    'Sem turma'
                  )}
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="event" /> Início das aulas
                </dt>
                <dd>
                  {data.classGroup
                    ? `${formatDate(data.classGroup.period.startsAt)} (${data.classGroup.period.name})`
                    : '—'}
                </dd>
              </div>
            </dl>
          </Panel>
          {data.message && (
            <Panel title="Mensagem do candidato" icon="chat_bubble">
              <p className="prose">{data.message}</p>
            </Panel>
          )}
          <Panel title="Histórico de notas" icon="history">
            {data.notes.length ? (
              <ol className="timeline">
                {data.notes.map((n) => (
                  <li key={n.id}>
                    <p>{n.body}</p>
                    <small>
                      {n.author} · {formatDate(n.createdAt)} ({relativeTime(n.createdAt)})
                    </small>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted-text">Ainda não existem notas internas.</p>
            )}
          </Panel>
        </div>
        {can('registrations.manage') && (
          <Panel title="Decisão" icon="gavel" className="detail-side">
            <form onSubmit={save} className="stack">
              <div className="status-picker" role="radiogroup" aria-label="Estado">
                {Object.entries(REGISTRATION_STATUS).map(([value, m]) => (
                  <label
                    key={value}
                    className={`status-option tone-${m.tone} ${nextStatus === value ? 'is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={value}
                      checked={nextStatus === value}
                      onChange={() => setStatus(value)}
                    />
                    <Icon name={m.icon} />
                    {m.label}
                  </label>
                ))}
              </div>
              <Field
                label="Turma"
                hint={
                  data.classOptions.length
                    ? 'Só aparecem turmas abertas deste curso com vagas.'
                    : 'Não há turmas abertas com vagas para este curso.'
                }
              >
                <select value={nextClass} onChange={(e) => setClassId(e.target.value)}>
                  <option value="">Lista de espera / sem turma</option>
                  {data.classGroup && (
                    <option value={data.classGroup.id}>{data.classGroup.code} (actual)</option>
                  )}
                  {data.classOptions
                    .filter((c) => c.id !== data.classGroup?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id} disabled={c.seatsLeft === 0}>
                        {c.campus.name} · {SHIFTS[c.shift]} · {formatDate(c.period.startsAt)} —{' '}
                        {c.seatsLeft} vagas
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Nota interna" hint="Visível apenas para a equipa.">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Ex.: Contactado por telefone, aguarda documentos."
                />
              </Field>
              <button className="btn btn-primary btn-block" disabled={busy}>
                <Icon name="save" /> {busy ? 'A guardar…' : 'Guardar'}
              </button>
            </form>
          </Panel>
        )}
      </div>
    </>
  );
}
