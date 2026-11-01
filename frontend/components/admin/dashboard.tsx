'use client';
import Link from 'next/link';
import { Icon } from '../icon';
import { useAdmin } from './admin-layout';
import { AreaChart, BarList, DonutChart } from './charts';
import {
  EmptyState,
  ErrorState,
  Panel,
  PageHeader,
  Skeleton,
  StatCard,
  StatusBadge,
  useResource,
} from './ui';
import { apiFetch } from '@/lib/api';
import { MESSAGE_STATUS, REGISTRATION_STATUS } from '@/lib/constants';
import { formatDateTime, formatNumber, percentChange, relativeTime } from '@/lib/format';

type Point = { month: string; total: number };
type Dashboard = {
  registrations: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    byStatus: Record<string, number>;
    trend: Point[];
    topCourses: { name: string; total: number }[];
    recent: {
      id: string;
      reference: string;
      name: string;
      courseName: string;
      status: string;
      createdAt: string;
    }[];
  };
  messages: {
    total: number;
    unread: number;
    inProgress: number;
    trend: Point[];
    recent: { id: string; name: string; subject: string; status: string; createdAt: string }[];
  };
  courses: { total: number; open: number };
  content: {
    newsPublished: number;
    newsDrafts: number;
    eventsUpcoming: number;
    albums: number;
    photos: number;
    nextEvents: {
      id: string;
      title: string;
      startsAt: string;
      location: string;
      published: boolean;
    }[];
  };
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite';
}

export function Dashboard() {
  const { me, can } = useAdmin();
  const { data, error, loading, reload } = useResource(
    () => apiFetch<Dashboard>('/admin/dashboard'),
    [],
  );
  const firstName = (me.displayName || me.email).split(/[\s@]/)[0];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Resumo da actividade do centro de formação nos últimos seis meses."
        actions={
          <button className="btn btn-ghost" onClick={reload} disabled={loading}>
            <Icon name="refresh" /> Actualizar
          </button>
        }
      />
      {error && <ErrorState message={error} onRetry={reload} />}
      {!data && loading && <Skeleton rows={4} height={120} />}
      {data && (
        <DashboardBody
          data={data}
          canRegistrations={can('registrations.read')}
          canMessages={can('messages.read')}
        />
      )}
    </>
  );
}

function DashboardBody({
  data,
  canRegistrations,
  canMessages,
}: {
  data: Dashboard;
  canRegistrations: boolean;
  canMessages: boolean;
}) {
  const r = data.registrations;
  const pending = r.byStatus.PENDENTE ?? 0;
  const acceptance = r.total ? Math.round(((r.byStatus.ACEITE ?? 0) / r.total) * 100) : 0;
  const attention = [
    pending > 0 && {
      icon: 'hourglass_top',
      tone: 'warning',
      title: `${pending} ${pending === 1 ? 'inscrição pendente' : 'inscrições pendentes'}`,
      text: 'Analise e responda aos candidatos.',
      href: '/admin/inscricoes?status=PENDENTE',
    },
    data.messages.unread > 0 && {
      icon: 'mark_email_unread',
      tone: 'brand',
      title: `${data.messages.unread} ${data.messages.unread === 1 ? 'mensagem por ler' : 'mensagens por ler'}`,
      text: 'Pedidos recebidos pelo formulário de contacto.',
      href: '/admin/mensagens?status=NAO_LIDA',
    },
    data.content.newsDrafts > 0 && {
      icon: 'edit_note',
      tone: 'info',
      title: `${data.content.newsDrafts} ${data.content.newsDrafts === 1 ? 'notícia em rascunho' : 'notícias em rascunho'}`,
      text: 'Reveja e publique quando estiverem prontas.',
      href: '/admin/conteudos',
    },
    data.courses.open === 0 && {
      icon: 'event_busy',
      tone: 'danger',
      title: 'Nenhum curso com inscrições abertas',
      text: 'O formulário público não aceita candidaturas.',
      href: '/admin/cursos',
    },
  ].filter(Boolean) as { icon: string; tone: string; title: string; text: string; href: string }[];

  return (
    <div className="dashboard">
      <div className="stat-grid">
        <StatCard
          label="Inscrições este mês"
          value={formatNumber(r.thisMonth)}
          icon="how_to_reg"
          trend={percentChange(r.thisMonth, r.lastMonth)}
          hint="vs. mês anterior"
          href={canRegistrations ? '/admin/inscricoes' : undefined}
        />
        <StatCard
          label="Pendentes"
          value={formatNumber(pending)}
          icon="hourglass_top"
          tone="warning"
          hint={`${formatNumber(r.total)} inscrições no total`}
          href={canRegistrations ? '/admin/inscricoes?status=PENDENTE' : undefined}
        />
        <StatCard
          label="Taxa de aceitação"
          value={`${acceptance}%`}
          icon="verified"
          tone="success"
          hint={`${formatNumber(r.byStatus.ACEITE ?? 0)} candidatos aceites`}
        />
        <StatCard
          label="Mensagens por ler"
          value={formatNumber(data.messages.unread)}
          icon="forum"
          tone="info"
          hint={`${formatNumber(data.messages.inProgress)} em tratamento`}
          href={canMessages ? '/admin/mensagens' : undefined}
        />
      </div>

      <div className="dash-row dash-row-main">
        <Panel title="Inscrições por mês" icon="show_chart">
          <AreaChart data={r.trend} label="Inscrições por mês" />
        </Panel>
        <Panel title="Estado das inscrições" icon="donut_large">
          <DonutChart
            centerLabel="inscrições"
            items={Object.entries(REGISTRATION_STATUS).map(([key, meta]) => ({
              key,
              meta,
              value: r.byStatus[key] ?? 0,
            }))}
          />
        </Panel>
      </div>

      <div className="dash-row">
        <Panel title="Cursos mais procurados" icon="leaderboard">
          <BarList
            items={r.topCourses.map((c) => ({ label: c.name, value: c.total }))}
            empty="Ainda não há inscrições."
          />
        </Panel>
        <Panel title="Precisa de atenção" icon="notification_important">
          {attention.length ? (
            <ul className="attention-list">
              {attention.map((a) => (
                <li key={a.title}>
                  <Link href={a.href}>
                    <span className={`stat-icon tone-${a.tone}`}>
                      <Icon name={a.icon} />
                    </span>
                    <span>
                      <strong>{a.title}</strong>
                      <small>{a.text}</small>
                    </span>
                    <Icon name="chevron_right" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="task_alt"
              title="Tudo em dia"
              description="Não há pendências neste momento."
            />
          )}
        </Panel>
        <Panel title="Conteúdos" icon="newspaper">
          <dl className="mini-stats">
            <div>
              <dt>
                <Icon name="article" /> Notícias publicadas
              </dt>
              <dd>{data.content.newsPublished}</dd>
            </div>
            <div>
              <dt>
                <Icon name="event" /> Próximos eventos
              </dt>
              <dd>{data.content.eventsUpcoming}</dd>
            </div>
            <div>
              <dt>
                <Icon name="photo_library" /> Álbuns
              </dt>
              <dd>{data.content.albums}</dd>
            </div>
            <div>
              <dt>
                <Icon name="image" /> Fotografias
              </dt>
              <dd>{data.content.photos}</dd>
            </div>
            <div>
              <dt>
                <Icon name="school" /> Cursos abertos
              </dt>
              <dd>
                {data.courses.open} / {data.courses.total}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      <div className="dash-row dash-row-half">
        <Panel
          title="Inscrições recentes"
          icon="assignment_ind"
          padded={false}
          actions={
            canRegistrations && (
              <Link className="link-more" href="/admin/inscricoes">
                Ver todas
              </Link>
            )
          }
        >
          {r.recent.length ? (
            <ul className="feed">
              {r.recent.map((x) => (
                <li key={x.id}>
                  <Link href={canRegistrations ? `/admin/inscricoes/${x.id}` : '#'}>
                    <span>
                      <strong>{x.name}</strong>
                      <small>
                        {x.courseName} · {relativeTime(x.createdAt)}
                      </small>
                    </span>
                    <StatusBadge meta={REGISTRATION_STATUS[x.status]} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="assignment" title="Sem inscrições" />
          )}
        </Panel>
        <Panel
          title="Mensagens e agenda"
          icon="forum"
          padded={false}
          actions={
            canMessages && (
              <Link className="link-more" href="/admin/mensagens">
                Abrir caixa
              </Link>
            )
          }
        >
          <ul className="feed">
            {data.messages.recent.map((m) => (
              <li key={m.id}>
                <Link href={canMessages ? `/admin/mensagens?abrir=${m.id}` : '#'}>
                  <span>
                    <strong>{m.subject}</strong>
                    <small>
                      {m.name} · {relativeTime(m.createdAt)}
                    </small>
                  </span>
                  <StatusBadge meta={MESSAGE_STATUS[m.status]} />
                </Link>
              </li>
            ))}
            {data.content.nextEvents.map((e) => (
              <li key={e.id}>
                <Link href="/admin/conteudos?tab=events">
                  <span>
                    <strong>{e.title}</strong>
                    <small>
                      {formatDateTime(e.startsAt)}
                      {e.location ? ` · ${e.location}` : ''}
                    </small>
                  </span>
                  <span className="badge tone-info">
                    <Icon name="event" /> Evento
                  </span>
                </Link>
              </li>
            ))}
            {!data.messages.recent.length && !data.content.nextEvents.length && (
              <li className="feed-empty">Sem mensagens por tratar nem eventos agendados.</li>
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
