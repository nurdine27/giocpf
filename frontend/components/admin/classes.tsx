'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icon } from '../icon';
import { useAdmin } from './admin-layout';
import { useConfirm, useToast } from './feedback';
import {
  ActionMenu,
  Avatar,
  CardList,
  EmptyState,
  ErrorState,
  Field,
  ListCard,
  Modal,
  PageHeader,
  Panel,
  Skeleton,
  StatusBadge,
  Switch,
  Tabs,
  useResource,
  type MenuAction,
} from './ui';
import { apiFetch, downloadFile, errorMessage } from '@/lib/api';
import { CLASS_STATUS, REGISTRATION_STATUS, SHIFTS, occupancyTone } from '@/lib/constants';
import { formatDate, toLocalInput } from '@/lib/format';

type Campus = {
  id: string;
  name: string;
  city: string;
  address: string;
  active: boolean;
  _count?: { classes: number; registrations: number };
};
type Period = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  enrollmentClosesAt: string | null;
  active: boolean;
  _count?: { classes: number; extensions?: number };
  extensions?: PeriodExtension[];
};
type PeriodExtension = {
  id: string;
  reason: string;
  previousEndsAt: string | null;
  newEndsAt: string | null;
  previousEnrollmentClosesAt: string | null;
  newEnrollmentClosesAt: string | null;
  createdAt: string;
};

/** Where a period stands today, shown next to its name. */
function periodState(p: Period): { label: string; tone: string } {
  const now = Date.now();
  if (!p.active) return { label: 'Inactivo', tone: 'neutral' };
  if (p.endsAt && new Date(p.endsAt).getTime() < now)
    return { label: 'Terminado', tone: 'neutral' };
  if (new Date(p.startsAt).getTime() > now) {
    if (p.enrollmentClosesAt && new Date(p.enrollmentClosesAt).getTime() < now)
      return { label: 'Inscrições encerradas', tone: 'warning' };
    return { label: 'Inscrições abertas', tone: 'success' };
  }
  return { label: 'A decorrer', tone: 'info' };
}
type ClassRow = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  shift: string;
  schedule: string;
  status: string;
  seatsTaken: number;
  waitlist: number;
  course: { id: string; name: string; area: string };
  campus: { id: string; name: string };
  period: { id: string; name: string; startsAt: string; endsAt: string | null };
};
type Options = {
  courses: { id: string; name: string; area: string }[];
  campuses: Campus[];
  periods: Period[];
};

type Tab = 'classes' | 'periods' | 'campuses';

export function ClassesAdmin() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'classes');
  const options = useResource(() => apiFetch<Options>('/admin/classes/options'), []);
  return (
    <>
      <PageHeader
        title="Turmas"
        description="Organize as turmas por pólo e período, defina o número de vagas e acompanhe a ocupação."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'classes', label: 'Turmas', icon: 'groups' },
          { value: 'periods', label: 'Períodos', icon: 'date_range' },
          { value: 'campuses', label: 'Pólos', icon: 'location_city' },
        ]}
      />
      {tab === 'classes' && <ClassesTab options={options.data} />}
      {tab === 'periods' && <PeriodsTab onChange={options.reload} />}
      {tab === 'campuses' && <CampusesTab onChange={options.reload} />}
    </>
  );
}

/* ====================================================================== */
/* Classes                                                                */
/* ====================================================================== */

function Occupancy({
  taken,
  capacity,
  waitlist,
}: {
  taken: number;
  capacity: number;
  waitlist?: number;
}) {
  const tone = occupancyTone(taken, capacity);
  const left = Math.max(0, capacity - taken);
  return (
    <div className="occupancy">
      <div className="occupancy-top">
        <strong>
          {taken}/{capacity}
        </strong>
        <small>{left ? `${left} ${left === 1 ? 'vaga' : 'vagas'}` : 'Lotada'}</small>
      </div>
      <span className={`occupancy-bar tone-${tone}`}>
        <span style={{ width: `${Math.min(100, (taken / Math.max(1, capacity)) * 100)}%` }} />
      </span>
      {waitlist ? (
        <small className="occupancy-wait">
          <Icon name="schedule" /> {waitlist} em espera
        </small>
      ) : null}
    </div>
  );
}

function ClassesTab({ options }: { options: Options | null }) {
  const { can } = useAdmin();
  const toast = useToast();
  const confirm = useConfirm();
  const [campusId, setCampusId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<ClassRow | 'new' | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const canManage = can('classes.manage');
  const canExport = can('registrations.export');

  const { data, error, loading, reload } = useResource(() => {
    const qs = new URLSearchParams();
    if (campusId) qs.set('campusId', campusId);
    if (periodId) qs.set('periodId', periodId);
    if (status) qs.set('status', status);
    return apiFetch<ClassRow[]>(`/admin/classes?${qs}`);
  }, [campusId, periodId, status]);

  const totals = useMemo(() => {
    const rows = data ?? [];
    return {
      capacity: rows.reduce((s, r) => s + r.capacity, 0),
      taken: rows.reduce((s, r) => s + r.seatsTaken, 0),
    };
  }, [data]);

  async function setClassStatus(row: ClassRow, next: string) {
    const ok = await confirm({
      title:
        next === 'ABERTA'
          ? 'Abrir inscrições na turma?'
          : `Marcar turma como «${CLASS_STATUS[next].label}»?`,
      message:
        next === 'ABERTA'
          ? 'Novos candidatos passam a ser colocados automaticamente nesta turma.'
          : 'A turma deixa de receber novos candidatos automaticamente.',
      confirmLabel: 'Confirmar',
      tone: next === 'CANCELADA' ? 'danger' : 'primary',
      icon: CLASS_STATUS[next].icon,
    });
    if (!ok) return;
    try {
      const result = await apiFetch<{ promoted: number }>(`/admin/classes/${row.id}`, {
        method: 'PATCH',
        body: { status: next },
      });
      toast.success(
        result.promoted
          ? `${result.promoted} candidatos em espera foram colocados na turma.`
          : 'Estado da turma actualizado.',
      );
      void reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function remove(row: ClassRow) {
    const ok = await confirm({
      title: 'Eliminar turma?',
      message: (
        <>
          A turma <strong>{row.code}</strong> será eliminada. Só é possível se não tiver inscrições.
        </>
      ),
      confirmLabel: 'Eliminar',
      icon: 'delete_forever',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/classes/${row.id}`, { method: 'DELETE' });
      toast.success('Turma eliminada.');
      void reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function exportCsv(row: Pick<ClassRow, 'id' | 'code'>) {
    try {
      await downloadFile(`/admin/classes/${row.id}/export`, `turma-${row.code}.csv`);
      toast.success('Lista exportada.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const actions = (row: ClassRow): MenuAction[] => [
    { label: 'Ver estudantes', icon: 'groups', onSelect: () => setViewing(row.id) },
    { label: 'Editar turma', icon: 'edit', hidden: !canManage, onSelect: () => setEditing(row) },
    {
      label: 'Exportar lista (CSV)',
      icon: 'download',
      hidden: !canExport,
      onSelect: () => exportCsv(row),
    },
    {
      label: 'Abrir inscrições',
      icon: 'how_to_reg',
      hidden: !canManage || row.status === 'ABERTA',
      onSelect: () => setClassStatus(row, 'ABERTA'),
    },
    {
      label: 'Fechar inscrições',
      icon: 'lock',
      hidden: !canManage || row.status !== 'ABERTA',
      onSelect: () => setClassStatus(row, 'FECHADA'),
    },
    {
      label: 'Marcar como em curso',
      icon: 'play_circle',
      hidden: !canManage || row.status === 'EM_CURSO',
      onSelect: () => setClassStatus(row, 'EM_CURSO'),
    },
    {
      label: 'Marcar como concluída',
      icon: 'task_alt',
      hidden: !canManage || row.status === 'CONCLUIDA',
      onSelect: () => setClassStatus(row, 'CONCLUIDA'),
    },
    {
      label: 'Eliminar',
      icon: 'delete',
      danger: true,
      hidden: !canManage,
      onSelect: () => remove(row),
    },
  ];

  const noSetup = options && (!options.periods.length || !options.campuses.length);

  return (
    <>
      {noSetup && (
        <div className="callout">
          <Icon name="info" />
          <span>
            Antes de criar turmas, registe pelo menos um <strong>período</strong> e um{' '}
            <strong>pólo</strong> nos separadores acima.
          </span>
        </div>
      )}
      <div className="stat-strip">
        <span>
          <Icon name="groups" /> <strong>{data?.length ?? 0}</strong> turmas
        </span>
        <span>
          <Icon name="event_seat" /> <strong>{totals.taken}</strong> de {totals.capacity} vagas
          ocupadas
        </span>
        {canManage && (
          <button
            className="btn btn-primary"
            onClick={() => setEditing('new')}
            disabled={!!noSetup}
          >
            <Icon name="add" /> Nova turma
          </button>
        )}
      </div>
      <Panel padded={false}>
        <div className="toolbar">
          <Tabs
            value={status}
            onChange={setStatus}
            items={[
              { value: '', label: 'Todas' },
              ...Object.entries(CLASS_STATUS).map(([value, m]) => ({ value, label: m.label })),
            ]}
          />
          <div className="filter-selects">
            <select
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              aria-label="Pólo"
            >
              <option value="">Todos os pólos</option>
              {options?.campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              aria-label="Período"
            >
              <option value="">Todos os períodos</option>
              {options?.periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data && <Skeleton rows={5} height={60} />}
        {data && data.length === 0 && (
          <EmptyState
            icon="groups"
            title="Nenhuma turma"
            description="Crie turmas para cada curso, pólo e período. Os candidatos são colocados automaticamente."
            action={
              canManage && !noSetup ? (
                <button className="btn btn-primary" onClick={() => setEditing('new')}>
                  <Icon name="add" /> Criar turma
                </button>
              ) : undefined
            }
          />
        )}
        {data && data.length > 0 && (
          <>
            <div className={`table-wrap only-desktop ${loading ? 'is-loading' : ''}`}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Turma</th>
                    <th>Pólo</th>
                    <th>Período</th>
                    <th>Ocupação</th>
                    <th>Estado</th>
                    <th aria-label="Acções" />
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.id} className="is-clickable" onClick={() => setViewing(row.id)}>
                      <td>
                        <span className="cell-title">{row.course.name}</span>
                        <small className="cell-sub">
                          {row.code} · {SHIFTS[row.shift]}
                          {row.schedule ? ` · ${row.schedule}` : ''}
                        </small>
                      </td>
                      <td>{row.campus.name}</td>
                      <td>
                        {row.period.name}
                        <small className="cell-sub">Início {formatDate(row.period.startsAt)}</small>
                      </td>
                      <td>
                        <Occupancy
                          taken={row.seatsTaken}
                          capacity={row.capacity}
                          waitlist={row.waitlist}
                        />
                      </td>
                      <td>
                        <StatusBadge meta={CLASS_STATUS[row.status]} />
                      </td>
                      <td className="right">
                        <ActionMenu label={row.code} actions={actions(row)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardList>
              {data.map((row) => (
                <ListCard
                  key={row.id}
                  onOpen={() => setViewing(row.id)}
                  media={
                    <span className="thumb">
                      <Icon name="groups" />
                    </span>
                  }
                  title={row.course.name}
                  subtitle={`${row.campus.name} · ${SHIFTS[row.shift]} · início ${formatDate(row.period.startsAt)}`}
                  meta={
                    <>
                      <StatusBadge meta={CLASS_STATUS[row.status]} />
                      <span className={`badge tone-${occupancyTone(row.seatsTaken, row.capacity)}`}>
                        <Icon name="event_seat" /> {row.seatsTaken}/{row.capacity}
                      </span>
                      {row.waitlist > 0 && <span>{row.waitlist} em espera</span>}
                    </>
                  }
                  actions={actions(row)}
                />
              ))}
            </CardList>
          </>
        )}
      </Panel>
      {editing && options && (
        <ClassForm
          row={editing === 'new' ? null : editing}
          options={options}
          onClose={() => setEditing(null)}
          onSaved={(promoted) => {
            setEditing(null);
            if (promoted)
              toast.info(`${promoted} candidatos em lista de espera foram colocados nesta turma.`);
            void reload();
          }}
        />
      )}
      {viewing && (
        <ClassDetail
          id={viewing}
          onClose={() => setViewing(null)}
          onExport={canExport ? exportCsv : undefined}
        />
      )}
    </>
  );
}

function ClassForm({
  row,
  options,
  onClose,
  onSaved,
}: {
  row: ClassRow | null;
  options: Options;
  onClose: () => void;
  onSaved: (promoted: number) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const activePeriods = options.periods.filter((p) => p.active || p.id === row?.period.id);
  const activeCampuses = options.campuses.filter((c) => c.active || c.id === row?.campus.id);
  const [form, setForm] = useState({
    courseId: row?.course.id ?? '',
    campusId: row?.campus.id ?? activeCampuses[0]?.id ?? '',
    periodId: row?.period.id ?? activePeriods[0]?.id ?? '',
    capacity: row?.capacity ?? 25,
    shift: row?.shift ?? 'MANHA',
    schedule: row?.schedule ?? '',
    name: row?.name ?? '',
    status: row?.status ?? 'ABERTA',
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await apiFetch<{ promoted: number }>(
        row ? `/admin/classes/${row.id}` : '/admin/classes',
        {
          method: row ? 'PATCH' : 'POST',
          body: { ...form, capacity: Number(form.capacity) },
        },
      );
      toast.success(row ? 'Turma actualizada.' : 'Turma criada.');
      onSaved(result.promoted);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={row ? `Editar turma ${row.code}` : 'Nova turma'}
      description="O código é gerado automaticamente. Os candidatos são colocados enquanto houver vagas."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="class-form" className="btn btn-primary" disabled={busy}>
            <Icon name="save" /> {busy ? 'A guardar…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="class-form" className="form-grid-2" onSubmit={submit}>
        <Field label="Curso" required full>
          <select
            value={form.courseId}
            onChange={(e) => set('courseId', e.target.value)}
            required
            disabled={!!row && row.seatsTaken > 0}
          >
            <option value="">Seleccione o curso</option>
            {options.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.area}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pólo" required>
          <select value={form.campusId} onChange={(e) => set('campusId', e.target.value)} required>
            {activeCampuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Período" required hint="Define quando as aulas começam.">
          <select value={form.periodId} onChange={(e) => set('periodId', e.target.value)} required>
            {activePeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (início {formatDate(p.startsAt)})
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Número de vagas"
          required
          hint={
            row
              ? `Ocupadas: ${row.seatsTaken}. Não pode ser inferior.`
              : 'Lugares disponíveis na turma.'
          }
        >
          <input
            type="number"
            min={Math.max(1, row?.seatsTaken ?? 1)}
            max={500}
            value={form.capacity}
            onChange={(e) => set('capacity', Number(e.target.value))}
            required
          />
        </Field>
        <Field label="Turno" required>
          <select value={form.shift} onChange={(e) => set('shift', e.target.value)}>
            {Object.entries(SHIFTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Horário" hint="Ex.: Seg. a Sex., 08:00–12:00">
          <input
            value={form.schedule}
            onChange={(e) => set('schedule', e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label="Estado">
          <select value={form.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(CLASS_STATUS).map(([value, m]) => (
              <option key={value} value={value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nome (opcional)" hint="Por omissão: curso · turno." full>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} />
        </Field>
      </form>
    </Modal>
  );
}

type ClassDetailData = ClassRow & {
  campus: Campus;
  period: Period;
  registrations: {
    id: string;
    reference: string;
    name: string;
    phone: string;
    email: string | null;
    status: string;
  }[];
};

function ClassDetail({
  id,
  onClose,
  onExport,
}: {
  id: string;
  onClose: () => void;
  onExport?: (row: { id: string; code: string }) => void;
}) {
  const { data, error } = useResource(
    () => apiFetch<ClassDetailData>(`/admin/classes/${id}`),
    [id],
  );
  return (
    <Modal
      title={data ? data.course.name : 'Turma'}
      description={data ? `${data.code} · ${data.campus.name} · ${SHIFTS[data.shift]}` : undefined}
      onClose={onClose}
      variant="drawer"
      size="lg"
      footer={
        data &&
        onExport && (
          <button className="btn btn-ghost" onClick={() => onExport(data)}>
            <Icon name="download" /> Exportar lista (CSV)
          </button>
        )
      }
    >
      {error && <ErrorState message={error} />}
      {!data && !error && <Skeleton rows={5} />}
      {data && (
        <div className="stack">
          <dl className="info-list">
            <div>
              <dt>
                <Icon name="date_range" /> Período
              </dt>
              <dd>
                {data.period.name} · {formatDate(data.period.startsAt)}
                {data.period.endsAt ? ` a ${formatDate(data.period.endsAt)}` : ''}
              </dd>
            </div>
            <div>
              <dt>
                <Icon name="schedule" /> Horário
              </dt>
              <dd>{data.schedule || SHIFTS[data.shift]}</dd>
            </div>
            <div>
              <dt>
                <Icon name="location_on" /> Pólo
              </dt>
              <dd>
                {data.campus.name}
                {data.campus.address ? ` · ${data.campus.address}` : ''}
              </dd>
            </div>
            <div>
              <dt>
                <Icon name="flag" /> Estado
              </dt>
              <dd>
                <StatusBadge meta={CLASS_STATUS[data.status]} />
              </dd>
            </div>
          </dl>
          <Occupancy taken={data.seatsTaken} capacity={data.capacity} />
          <h3 className="section-title">Estudantes ({data.registrations.length})</h3>
          {data.registrations.length ? (
            <ul className="feed feed-bordered">
              {data.registrations.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/inscricoes/${r.id}`}>
                    <span className="feed-person">
                      <Avatar name={r.name} size={34} />
                      <span>
                        <strong>{r.name}</strong>
                        <small>
                          {r.reference} · {r.phone}
                        </small>
                      </span>
                    </span>
                    <StatusBadge meta={REGISTRATION_STATUS[r.status]} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-text">Ainda não há estudantes nesta turma.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ====================================================================== */
/* Periods                                                                */
/* ====================================================================== */

function PeriodsTab({ onChange }: { onChange: () => Promise<void> }) {
  const { can } = useAdmin();
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = can('classes.manage');
  const { data, error, loading, reload } = useResource(
    () => apiFetch<Period[]>('/admin/periods'),
    [],
  );
  const [editing, setEditing] = useState<Period | 'new' | null>(null);
  const [extending, setExtending] = useState<Period | null>(null);

  async function refresh() {
    await Promise.all([reload(), onChange()]);
  }

  async function toggle(p: Period) {
    try {
      await apiFetch(`/admin/periods/${p.id}`, { method: 'PATCH', body: { active: !p.active } });
      toast.success(p.active ? 'Período desactivado.' : 'Período activado.');
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function remove(p: Period) {
    const ok = await confirm({
      title: 'Eliminar período?',
      message: <>«{p.name}» será eliminado. Só é possível se não tiver turmas.</>,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/periods/${p.id}`, { method: 'DELETE' });
      toast.success('Período eliminado.');
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const actions = (p: Period): MenuAction[] => [
    {
      label: 'Prolongar período',
      icon: 'more_time',
      hidden: !canManage,
      onSelect: () => setExtending(p),
    },
    { label: 'Editar', icon: 'edit', hidden: !canManage, onSelect: () => setEditing(p) },
    {
      label: p.active ? 'Desactivar' : 'Activar',
      icon: p.active ? 'toggle_off' : 'toggle_on',
      hidden: !canManage,
      onSelect: () => toggle(p),
    },
    {
      label: 'Eliminar',
      icon: 'delete',
      danger: true,
      hidden: !canManage,
      onSelect: () => remove(p),
    },
  ];

  return (
    <>
      <div className="stat-strip">
        <span>
          <Icon name="info" /> Um período define quando as aulas começam e pode servir várias
          turmas.
        </span>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="add" /> Novo período
          </button>
        )}
      </div>
      <Panel padded={false}>
        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data && <Skeleton rows={4} />}
        {data && data.length === 0 && (
          <EmptyState
            icon="date_range"
            title="Sem períodos"
            description="Crie o primeiro período lectivo."
          />
        )}
        {data && data.length > 0 && (
          <>
            <div className="table-wrap only-desktop">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Início das aulas</th>
                    <th>Fim</th>
                    <th>Inscrições até</th>
                    <th className="center">Turmas</th>
                    <th className="center">Activo</th>
                    <th aria-label="Acções" />
                  </tr>
                </thead>
                <tbody>
                  {data.map((p) => (
                    <tr key={p.id} className={p.active ? '' : 'is-muted'}>
                      <td>
                        <span className="cell-title">{p.name}</span>
                        <small className="cell-sub">
                          <span className={`text-tone tone-${periodState(p).tone}`}>
                            {periodState(p).label}
                          </span>
                          {p._count?.extensions ? ` · prolongado ${p._count.extensions}×` : ''}
                        </small>
                      </td>
                      <td>{formatDate(p.startsAt)}</td>
                      <td>{formatDate(p.endsAt)}</td>
                      <td>
                        {p.enrollmentClosesAt ? formatDate(p.enrollmentClosesAt) : 'Sem limite'}
                      </td>
                      <td className="center">{p._count?.classes ?? 0}</td>
                      <td className="center">
                        <Switch
                          checked={p.active}
                          label={`Activar ${p.name}`}
                          onChange={() => toggle(p)}
                          disabled={!canManage}
                        />
                      </td>
                      <td className="right">
                        <ActionMenu label={p.name} actions={actions(p)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardList>
              {data.map((p) => (
                <ListCard
                  key={p.id}
                  muted={!p.active}
                  media={
                    <span className="thumb">
                      <Icon name="date_range" />
                    </span>
                  }
                  title={p.name}
                  subtitle={`Início ${formatDate(p.startsAt)}${p.endsAt ? ` · fim ${formatDate(p.endsAt)}` : ''}`}
                  meta={
                    <>
                      <span className={`badge tone-${p.active ? 'success' : 'neutral'}`}>
                        {p.active ? 'Activo' : 'Inactivo'}
                      </span>
                      <span className={`badge tone-${periodState(p).tone}`}>
                        {periodState(p).label}
                      </span>
                      <span>{p._count?.classes ?? 0} turmas</span>
                      {p._count?.extensions ? <span>Prolongado {p._count.extensions}×</span> : null}
                    </>
                  }
                  actions={actions(p)}
                />
              ))}
            </CardList>
          </>
        )}
      </Panel>
      {extending && (
        <ExtendPeriodForm
          period={extending}
          onClose={() => setExtending(null)}
          onSaved={async (promoted) => {
            setExtending(null);
            if (promoted)
              toast.info(`${promoted} candidatos em lista de espera foram colocados em turmas.`);
            await refresh();
          }}
        />
      )}
      {editing && (
        <PeriodForm
          period={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </>
  );
}

function addDays(base: string, days: number) {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function ExtendPeriodForm({
  period,
  onClose,
  onSaved,
}: {
  period: Period;
  onClose: () => void;
  onSaved: (promoted: number) => void;
}) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const currentEnd = period.endsAt ? toLocalInput(period.endsAt).slice(0, 10) : '';
  const currentClose = period.enrollmentClosesAt
    ? toLocalInput(period.enrollmentClosesAt).slice(0, 10)
    : '';
  const [endsAt, setEndsAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const baseEnd = currentEnd && currentEnd > today ? currentEnd : today;
  const baseClose = currentClose && currentClose > today ? currentClose : today;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!endsAt && !closesAt) {
      toast.info('Escolha a nova data de fim ou o novo prazo de inscrições.');
      return;
    }
    setBusy(true);
    try {
      const result = await apiFetch<{ promoted: number }>(`/admin/periods/${period.id}/extend`, {
        method: 'POST',
        body: {
          endsAt: endsAt ? new Date(`${endsAt}T18:00:00`).toISOString() : '',
          enrollmentClosesAt: closesAt ? new Date(`${closesAt}T23:59:59`).toISOString() : '',
          reason,
        },
      });
      toast.success('Período prolongado.');
      onSaved(result.promoted);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const quick = [
    { label: '+1 semana', days: 7 },
    { label: '+2 semanas', days: 14 },
    { label: '+1 mês', days: 30 },
  ];

  return (
    <Modal
      title={`Prolongar «${period.name}»`}
      description="As datas só podem avançar. Cada prolongamento fica registado no histórico."
      onClose={onClose}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="extend-form" className="btn btn-primary" disabled={busy}>
            <Icon name="more_time" /> {busy ? 'A guardar…' : 'Prolongar'}
          </button>
        </>
      }
    >
      <form id="extend-form" className="stack" onSubmit={submit}>
        <dl className="info-list">
          <div>
            <dt>
              <Icon name="event" /> Início das aulas
            </dt>
            <dd>{formatDate(period.startsAt)}</dd>
          </div>
          <div>
            <dt>
              <Icon name="flag" /> Estado
            </dt>
            <dd>{periodState(period).label}</dd>
          </div>
        </dl>
        <div className="extend-block">
          <Field
            label="Novo fim das aulas"
            hint={`Actual: ${currentEnd ? formatDate(period.endsAt) : 'sem data'}`}
          >
            <input
              type="date"
              value={endsAt}
              min={addDays(currentEnd || period.startsAt.slice(0, 10), 1)}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
          <div className="quick-chips">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                className="chip-btn"
                onClick={() => setEndsAt(addDays(baseEnd, q.days))}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
        <div className="extend-block">
          <Field
            label="Novo prazo de inscrições"
            hint={`Actual: ${currentClose ? formatDate(period.enrollmentClosesAt) : 'sem limite'}`}
          >
            <input
              type="date"
              value={closesAt}
              min={addDays(currentClose || today, currentClose ? 1 : 0)}
              max={endsAt || currentEnd || undefined}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </Field>
          <div className="quick-chips">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                className="chip-btn"
                onClick={() => setClosesAt(addDays(baseClose, q.days))}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Motivo" hint="Opcional. Ex.: feriados, procura elevada, atraso do formador.">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </Field>
        {period.extensions && period.extensions.length > 0 && (
          <div>
            <h3 className="section-title">Histórico de prolongamentos</h3>
            <ol className="timeline extend-history">
              {period.extensions.map((x) => (
                <li key={x.id}>
                  <p>
                    {x.newEndsAt && (
                      <>
                        Fim: {x.previousEndsAt ? formatDate(x.previousEndsAt) : 'sem data'} →{' '}
                        <strong>{formatDate(x.newEndsAt)}</strong>
                        <br />
                      </>
                    )}
                    {x.newEnrollmentClosesAt && (
                      <>
                        Inscrições:{' '}
                        {x.previousEnrollmentClosesAt
                          ? formatDate(x.previousEnrollmentClosesAt)
                          : 'sem limite'}{' '}
                        → <strong>{formatDate(x.newEnrollmentClosesAt)}</strong>
                      </>
                    )}
                  </p>
                  <small>
                    {formatDate(x.createdAt)}
                    {x.reason ? ` · ${x.reason}` : ''}
                  </small>
                </li>
              ))}
            </ol>
          </div>
        )}
      </form>
    </Modal>
  );
}

function PeriodForm({
  period,
  onClose,
  onSaved,
}: {
  period: Period | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: period?.name ?? '',
    startsAt: toLocalInput(period?.startsAt).slice(0, 10),
    endsAt: toLocalInput(period?.endsAt).slice(0, 10),
    enrollmentClosesAt: toLocalInput(period?.enrollmentClosesAt).slice(0, 10),
  });
  const set = <K extends keyof typeof form>(key: K, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const iso = (v: string) => (v ? new Date(`${v}T08:00:00`).toISOString() : '');
    try {
      await apiFetch(period ? `/admin/periods/${period.id}` : '/admin/periods', {
        method: period ? 'PATCH' : 'POST',
        body: {
          name: form.name,
          startsAt: iso(form.startsAt),
          endsAt: iso(form.endsAt),
          enrollmentClosesAt: form.enrollmentClosesAt
            ? new Date(`${form.enrollmentClosesAt}T23:59:59`).toISOString()
            : '',
        },
      });
      toast.success(period ? 'Período actualizado.' : 'Período criado.');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={period ? 'Editar período' : 'Novo período'}
      onClose={onClose}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="period-form" className="btn btn-primary" disabled={busy}>
            <Icon name="save" /> {busy ? 'A guardar…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="period-form" className="form-grid-2" onSubmit={submit}>
        <Field label="Nome" required full hint="Ex.: Fevereiro 2027, 1.º Trimestre 2027">
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
            minLength={3}
            maxLength={80}
          />
        </Field>
        <Field label="Início das aulas" required>
          <input
            type="date"
            value={form.startsAt}
            onChange={(e) => set('startsAt', e.target.value)}
            required
          />
        </Field>
        <Field label="Fim das aulas">
          <input
            type="date"
            value={form.endsAt}
            min={form.startsAt}
            onChange={(e) => set('endsAt', e.target.value)}
          />
        </Field>
        <Field
          label="Inscrições até"
          hint="Depois desta data, as turmas deste período deixam de receber candidatos."
          full
        >
          <input
            type="date"
            value={form.enrollmentClosesAt}
            max={form.endsAt || undefined}
            onChange={(e) => set('enrollmentClosesAt', e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

/* ====================================================================== */
/* Campuses                                                               */
/* ====================================================================== */

function CampusesTab({ onChange }: { onChange: () => Promise<void> }) {
  const { can } = useAdmin();
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = can('classes.manage');
  const { data, error, loading, reload } = useResource(
    () => apiFetch<Campus[]>('/admin/campuses'),
    [],
  );
  const [editing, setEditing] = useState<Campus | 'new' | null>(null);

  async function refresh() {
    await Promise.all([reload(), onChange()]);
  }

  async function toggle(c: Campus) {
    if (c.active) {
      const ok = await confirm({
        title: 'Desactivar pólo?',
        message: <>«{c.name}» deixa de aparecer no formulário de inscrição.</>,
        confirmLabel: 'Desactivar',
      });
      if (!ok) return;
    }
    try {
      await apiFetch(`/admin/campuses/${c.id}`, { method: 'PATCH', body: { active: !c.active } });
      toast.success(c.active ? 'Pólo desactivado.' : 'Pólo activado.');
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function remove(c: Campus) {
    const ok = await confirm({
      title: 'Eliminar pólo?',
      message: <>«{c.name}» será eliminado. Só é possível se não tiver turmas nem inscrições.</>,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/campuses/${c.id}`, { method: 'DELETE' });
      toast.success('Pólo eliminado.');
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <Skeleton rows={2} height={120} />;
  return (
    <>
      <div className="stat-strip">
        <span>
          <Icon name="location_city" /> Locais onde decorrem as aulas.
        </span>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="add" /> Novo pólo
          </button>
        )}
      </div>
      <div className="role-grid">
        {data?.map((c) => (
          <Panel
            key={c.id}
            title={c.name}
            icon="location_city"
            className={c.active ? '' : 'is-muted'}
            actions={
              <ActionMenu
                label={c.name}
                actions={[
                  {
                    label: 'Editar',
                    icon: 'edit',
                    hidden: !canManage,
                    onSelect: () => setEditing(c),
                  },
                  {
                    label: c.active ? 'Desactivar' : 'Activar',
                    icon: c.active ? 'toggle_off' : 'toggle_on',
                    hidden: !canManage,
                    onSelect: () => toggle(c),
                  },
                  {
                    label: 'Eliminar',
                    icon: 'delete',
                    danger: true,
                    hidden: !canManage,
                    onSelect: () => remove(c),
                  },
                ]}
              />
            }
          >
            <p className="muted-text">
              {c.city}
              {c.address ? ` · ${c.address}` : ''}
            </p>
            <div className="role-foot">
              <span>
                <Icon name="groups" /> {c._count?.classes ?? 0} turmas ·{' '}
                {c._count?.registrations ?? 0} inscrições
              </span>
              <span className={`badge badge-sm tone-${c.active ? 'success' : 'neutral'}`}>
                {c.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </Panel>
        ))}
      </div>
      {editing && (
        <CampusForm
          campus={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </>
  );
}

function CampusForm({
  campus,
  onClose,
  onSaved,
}: {
  campus: Campus | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: campus?.name ?? '',
    city: campus?.city ?? '',
    address: campus?.address ?? '',
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch(campus ? `/admin/campuses/${campus.id}` : '/admin/campuses', {
        method: campus ? 'PATCH' : 'POST',
        body: form,
      });
      toast.success(campus ? 'Pólo actualizado.' : 'Pólo criado.');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={campus ? 'Editar pólo' : 'Novo pólo'}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="campus-form" className="btn btn-primary" disabled={busy}>
            <Icon name="save" /> {busy ? 'A guardar…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="campus-form" className="stack" onSubmit={submit}>
        <Field label="Nome" required>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            minLength={2}
            maxLength={80}
          />
        </Field>
        <Field label="Cidade" required>
          <input
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            required
            minLength={2}
            maxLength={80}
          />
        </Field>
        <Field label="Endereço">
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            maxLength={300}
          />
        </Field>
      </form>
    </Modal>
  );
}
