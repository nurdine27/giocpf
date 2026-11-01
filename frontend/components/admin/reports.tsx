'use client';
import { useMemo, useState } from 'react';
import { Icon } from '../icon';
import { useToast } from './feedback';
import {
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  Panel,
  Skeleton,
  Spinner,
  useResource,
} from './ui';
import { apiFetch, downloadFile, errorMessage } from '@/lib/api';
import { formatDateTime, relativeTime } from '@/lib/format';

type Filter = { key: string; label: string; source: string; required?: boolean };
type Report = {
  key: string;
  title: string;
  description: string;
  icon: string;
  group: string;
  dateRange: boolean;
  dateLabel?: string;
  filters: Filter[];
};
type Catalog = { reports: Report[]; options: Record<string, { value: string; label: string }[]> };
type HistoryItem = {
  number: string;
  issuedAt: string;
  issuedBy: string;
  report: string;
  format: string;
  rows: number;
};
type Verification = HistoryItem & { period?: string | null; filters?: string[]; hash: string };

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Quick date ranges; "to" is always inclusive. */
function presets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const daysAgo = (n: number) => new Date(y, m, now.getDate() - n);
  return [
    { label: 'Hoje', from: iso(now), to: iso(now) },
    { label: 'Últimos 7 dias', from: iso(daysAgo(6)), to: iso(now) },
    { label: 'Últimos 30 dias', from: iso(daysAgo(29)), to: iso(now) },
    { label: 'Este mês', from: iso(new Date(y, m, 1)), to: iso(now) },
    { label: 'Mês anterior', from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    { label: 'Este ano', from: iso(new Date(y, 0, 1)), to: iso(now) },
    { label: 'Ano anterior', from: iso(new Date(y - 1, 0, 1)), to: iso(new Date(y - 1, 11, 31)) },
  ];
}

export function ReportsAdmin() {
  const catalog = useResource(() => apiFetch<Catalog>('/admin/reports'), []);
  const history = useResource(() => apiFetch<HistoryItem[]>('/admin/reports/history'), []);
  const [open, setOpen] = useState<Report | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Report[]>();
    for (const r of catalog.data?.reports ?? []) map.set(r.group, [...(map.get(r.group) ?? []), r]);
    return [...map.entries()];
  }, [catalog.data]);

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Documentos oficiais em PDF ou Excel, com identificação da instituição, número de documento e código de verificação. Cada emissão fica registada na auditoria."
      />
      {catalog.error && <ErrorState message={catalog.error} onRetry={catalog.reload} />}
      {catalog.loading && !catalog.data && <Skeleton rows={3} height={110} />}
      <div className="reports-layout">
        <div className="reports-main">
          {groups.map(([group, reports]) => (
            <section key={group} className="report-group">
              <h2 className="section-title">{group}</h2>
              <div className="report-grid">
                {reports.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className="report-card"
                    onClick={() => setOpen(r)}
                  >
                    <span className="stat-icon tone-brand">
                      <Icon name={r.icon} />
                    </span>
                    <span className="report-card-copy">
                      <strong>{r.title}</strong>
                      <small>{r.description}</small>
                      <span className="report-card-tags">
                        <span className="badge badge-sm tone-danger">PDF</span>
                        <span className="badge badge-sm tone-success">Excel</span>
                        {r.dateRange ? (
                          <span className="badge badge-sm tone-neutral">
                            <Icon name="date_range" /> Por datas
                          </span>
                        ) : (
                          <span className="badge badge-sm tone-neutral">Situação actual</span>
                        )}
                      </span>
                    </span>
                    <Icon name="chevron_right" />
                  </button>
                ))}
              </div>
            </section>
          ))}
          {catalog.data && !catalog.data.reports.length && (
            <EmptyState
              icon="lock"
              title="Sem relatórios disponíveis"
              description="A sua função não inclui permissões de relatórios."
            />
          )}
        </div>
        <aside className="reports-side">
          <VerifyPanel />
          <Panel title="Últimos documentos" icon="history" padded={false}>
            {history.loading && !history.data && <Skeleton rows={3} />}
            {history.data && !history.data.length && (
              <p className="feed-empty">Ainda não foram emitidos documentos.</p>
            )}
            <ul className="feed">
              {history.data?.map((h) => (
                <li key={h.number}>
                  <div className="feed-static">
                    <span>
                      <strong>{h.report}</strong>
                      <small>
                        {h.number} · {h.issuedBy} · {relativeTime(h.issuedAt)}
                      </small>
                    </span>
                    <span
                      className={`badge badge-sm tone-${h.format === 'PDF' ? 'danger' : 'success'}`}
                    >
                      {h.format}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
      {open && catalog.data && (
        <ReportDialog
          report={open}
          options={catalog.data.options}
          onClose={() => setOpen(null)}
          onDone={() => void history.reload()}
        />
      )}
    </>
  );
}

function ReportDialog({
  report,
  options,
  onClose,
  onDone,
}: {
  report: Report;
  options: Catalog['options'];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [quick] = useState(presets);
  const [from, setFrom] = useState(quick[2].from);
  const [to, setTo] = useState(quick[2].to);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);

  async function generate(format: 'pdf' | 'xlsx') {
    if (report.dateRange && (!from || !to))
      return toast.warning('Indique as datas de início e de fim.');
    if (report.dateRange && to < from)
      return toast.warning('A data final deve ser igual ou posterior à inicial.');
    const missing = report.filters.find((f) => f.required && !filters[f.key]);
    if (missing) return toast.warning(`Seleccione: ${missing.label}.`);
    setBusy(format);
    try {
      const qs = new URLSearchParams({ format, ...(report.dateRange ? { from, to } : {}) });
      for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
      const name = await downloadFile(
        `/admin/reports/${report.key}?${qs}`,
        `${report.key}.${format}`,
      );
      toast.success(
        `Documento ${name.split('-').slice(0, 3).join('-')} emitido.`,
        'Relatório gerado',
      );
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      title={report.title}
      description={report.description}
      onClose={onClose}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Fechar
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!!busy}
            onClick={() => generate('xlsx')}
          >
            {busy === 'xlsx' ? <Spinner /> : <Icon name="table_view" />} Excel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!!busy}
            onClick={() => generate('pdf')}
          >
            {busy === 'pdf' ? <Spinner /> : <Icon name="picture_as_pdf" />} PDF
          </button>
        </>
      }
    >
      <div className="stack">
        {report.dateRange ? (
          <>
            <div className="form-grid-2">
              <Field label={`${report.dateLabel ?? 'Data'} — de`} required>
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label="até" required>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </div>
            <div className="quick-chips">
              {quick.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={`chip-btn ${from === p.from && to === p.to ? 'is-active' : ''}`}
                  onClick={() => {
                    setFrom(p.from);
                    setTo(p.to);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="callout">
            <Icon name="info" />
            <span>Este relatório mostra a situação actual; não depende de datas.</span>
          </div>
        )}
        {report.filters.length > 0 && (
          <div className="form-grid-2">
            {report.filters.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                required={f.required}
                full={f.source === 'classes'}
              >
                <select
                  value={filters[f.key] ?? ''}
                  onChange={(e) => setFilters((s) => ({ ...s, [f.key]: e.target.value }))}
                >
                  <option value="">{f.required ? 'Seleccione' : 'Todos'}</option>
                  {options[f.source]?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        )}
        <p className="muted-text">
          <Icon name="verified" /> O documento inclui o logótipo e os dados da instituição, o número
          de documento, quem o emitiu e quando, e um código de verificação em todas as páginas.
        </p>
      </div>
    </Modal>
  );
}

function VerifyPanel() {
  const toast = useToast();
  const [number, setNumber] = useState('');
  const [result, setResult] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      setResult(
        await apiFetch<Verification>(`/admin/reports/verify/${encodeURIComponent(number.trim())}`),
      );
    } catch (err) {
      toast.error(errorMessage(err), 'Documento não confirmado');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Verificar documento" icon="verified">
      <form className="inline-form" onSubmit={verify}>
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value.toUpperCase())}
          placeholder="REL-20261103-AB12CD"
          aria-label="Número do documento"
          required
        />
        <button className="btn btn-primary" disabled={busy}>
          {busy ? <Spinner /> : <Icon name="search" />}
        </button>
      </form>
      {result && (
        <div className="verify-result">
          <span className="badge tone-success">
            <Icon name="check_circle" /> Documento autêntico
          </span>
          <dl className="info-list info-list-stack">
            <div>
              <dt>Relatório</dt>
              <dd>
                {result.report} ({result.format})
              </dd>
            </div>
            <div>
              <dt>Emitido</dt>
              <dd>
                {formatDateTime(result.issuedAt)} por {result.issuedBy}
              </dd>
            </div>
            {result.period && (
              <div>
                <dt>Período</dt>
                <dd>{result.period}</dd>
              </div>
            )}
            {result.filters && result.filters.length > 0 && (
              <div>
                <dt>Filtros</dt>
                <dd>{result.filters.join(' · ')}</dd>
              </div>
            )}
            <div>
              <dt>Registos</dt>
              <dd>{result.rows}</dd>
            </div>
            <div>
              <dt>Verificação</dt>
              <dd className="mono">{result.hash.slice(0, 16).toUpperCase()}</dd>
            </div>
          </dl>
        </div>
      )}
    </Panel>
  );
}
