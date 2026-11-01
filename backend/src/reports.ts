import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import {
  CLASS_STATUSES,
  CONTACT_CATEGORIES,
  MESSAGE_STATUSES,
  REGISTRATION_STATUSES,
  SEAT_STATUSES,
  SHIFTS,
  type Permission,
} from './constants';
import { seatsTaken } from './class-allocation';
import type { ReportData } from './report-render';

/** Filter values shown in the admin and passed back as query parameters. */
export type FilterSource =
  | 'registrationStatus'
  | 'messageStatus'
  | 'messageCategory'
  | 'classStatus'
  | 'campuses'
  | 'courses'
  | 'periods'
  | 'classes'
  | 'admins'
  | 'auditModules'
  | 'contentKinds';

export type ReportFilter = { key: string; label: string; source: FilterSource; required?: boolean };

export type ReportParams = { from: Date; to: Date; filters: Record<string, string> };

export type ReportDefinition = {
  key: string;
  title: string;
  description: string;
  icon: string;
  group: string;
  /** Any of these permissions grants access. */
  permissions: Permission[];
  /** false for snapshot reports (current state, no date range). */
  dateRange: boolean;
  dateLabel?: string;
  filters: ReportFilter[];
  build: (db: PrismaService, p: ReportParams) => Promise<ReportData>;
};

const MAX_ROWS = 20000;

export const REGISTRATION_LABELS: Record<string, string> = {
  PENDENTE: 'Pendente',
  EM_ANALISE: 'Em análise',
  ACEITE: 'Aceite',
  RECUSADA: 'Recusada',
};
export const MESSAGE_LABELS: Record<string, string> = {
  NAO_LIDA: 'Não lida',
  LIDA: 'Lida',
  EM_TRATAMENTO: 'Em tratamento',
  RESPONDIDA: 'Respondida',
  ARQUIVADA: 'Arquivada',
};
export const CLASS_LABELS: Record<string, string> = {
  ABERTA: 'Inscrições abertas',
  FECHADA: 'Fechada',
  EM_CURSO: 'Em curso',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};
const CONTENT_LABELS: Record<string, string> = {
  news: 'Notícia',
  events: 'Evento',
  albums: 'Álbum',
};
const MODULE_LABELS: Record<string, string> = {
  registrations: 'Inscrições',
  classes: 'Turmas',
  courses: 'Cursos',
  content: 'Conteúdos',
  news: 'Notícias',
  events: 'Eventos',
  albums: 'Galeria',
  communications: 'Mensagens',
  users: 'Utilizadores',
  institution: 'Configurações',
  reports: 'Relatórios',
  system: 'Sistema',
};
const ACTION_LABELS: Record<string, string> = {
  ADMIN_CREATED: 'Conta de administrador criada',
  ADMIN_UPDATED: 'Conta de administrador alterada',
  ADMIN_DELETED: 'Conta de administrador eliminada',
  ROLE_CREATED: 'Função criada',
  ROLE_UPDATED: 'Função alterada',
  ROLE_DELETED: 'Função eliminada',
  PROFILE_UPDATED: 'Perfil actualizado',
  PASSWORD_CHANGED: 'Palavra-passe alterada',
  COURSE_CREATED: 'Curso criado',
  COURSE_UPDATED: 'Curso alterado',
  COURSE_DELETED: 'Curso eliminado',
  CLASS_CREATED: 'Turma criada',
  CLASS_UPDATED: 'Turma alterada',
  CLASS_DELETED: 'Turma eliminada',
  CLASS_EXPORTED: 'Lista de turma exportada',
  PERIOD_CREATED: 'Período criado',
  PERIOD_UPDATED: 'Período alterado',
  PERIOD_EXTENDED: 'Período prolongado',
  PERIOD_DELETED: 'Período eliminado',
  CAMPUS_CREATED: 'Pólo criado',
  CAMPUS_UPDATED: 'Pólo alterado',
  CAMPUS_DELETED: 'Pólo eliminado',
  CONTENT_UPDATED: 'Conteúdo alterado',
  CONTENT_DELETED: 'Conteúdo eliminado',
  NEWS_CREATED: 'Notícia criada',
  EVENTS_CREATED: 'Evento criado',
  ALBUMS_CREATED: 'Álbum criado',
  MESSAGE_REPLIED: 'Mensagem respondida',
  MESSAGE_DELETED: 'Mensagem eliminada',
  SETTINGS_UPDATED: 'Configurações alteradas',
  REPORT_EXPORTED: 'Relatório emitido',
};

const DETAIL_LABELS: Record<string, string> = {
  from: 'Estado anterior',
  fromClass: 'Turma anterior',
  toClass: 'Nova turma',
  promoted: 'Colocados da lista de espera',
  rows: 'Registos',
  fields: 'Campos alterados',
  endsAt: 'Novo fim',
  enrollmentClosesAt: 'Inscrições até',
  report: 'Relatório',
  format: 'Formato',
  period: 'Período',
  filters: 'Filtros',
  hash: 'Verificação',
  email: 'E-mail',
  name: 'Nome',
  keys: 'Configurações',
  emailSent: 'E-mail enviado',
};
const HIDDEN_DETAIL_KEYS = new Set(['reportKey']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

function detailValue(key: string, v: unknown): string {
  if (key === 'hash' && typeof v === 'string') return v.slice(0, 16).toUpperCase();
  if (key === 'from' && typeof v === 'string') return REGISTRATION_LABELS[v] ?? v;
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (typeof v === 'string' && ISO_DATE.test(v)) return new Date(v).toLocaleDateString('pt-PT');
  if (Array.isArray(v)) return v.map((x) => detailValue(key, x)).join(', ');
  if (v && typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function actionLabel(action: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith('STATUS_'))
    return `Inscrição: ${REGISTRATION_LABELS[action.slice(7)] ?? action.slice(7)}`;
  if (action.startsWith('MESSAGE_'))
    return `Mensagem: ${MESSAGE_LABELS[action.slice(8)] ?? action.slice(8)}`;
  return action;
}

const inRange = (p: ReportParams) => ({ gte: p.from, lte: p.to });
const count = (rows: { status?: string }[], status: string) =>
  rows.filter((r) => r.status === status).length;
const pct = (part: number, total: number) =>
  total ? `${Math.round((part / total) * 100)}%` : '0%';

function ageAt(birth: Date | null, at = new Date()) {
  if (!birth) return null;
  let age = at.getFullYear() - birth.getFullYear();
  const m = at.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birth.getDate())) age--;
  return age;
}

export const REPORTS: ReportDefinition[] = [
  {
    key: 'inscricoes',
    title: 'Relatório de inscrições',
    description: 'Todas as inscrições recebidas no período, com estado, curso, pólo e turma.',
    icon: 'assignment_ind',
    group: 'Académico',
    permissions: ['registrations.export'],
    dateRange: true,
    dateLabel: 'Data de inscrição',
    filters: [
      { key: 'status', label: 'Estado', source: 'registrationStatus' },
      { key: 'campusId', label: 'Pólo', source: 'campuses' },
      { key: 'courseId', label: 'Curso', source: 'courses' },
    ],
    async build(db, p) {
      const f = p.filters;
      const rows = await db.registration.findMany({
        where: {
          createdAt: inRange(p),
          ...((REGISTRATION_STATUSES as readonly string[]).includes(f.status)
            ? { status: f.status as never }
            : {}),
          ...(f.campusId ? { campusId: f.campusId } : {}),
          ...(f.courseId ? { courseId: f.courseId } : {}),
        },
        include: { campus: { select: { name: true } }, classGroup: { select: { code: true } } },
        orderBy: { createdAt: 'asc' },
        take: MAX_ROWS,
      });
      return {
        title: 'Relatório de inscrições',
        subtitle: 'Candidaturas recebidas através do formulário público.',
        landscape: true,
        columns: [
          { key: 'createdAt', header: 'Data', width: 11, kind: 'date' },
          { key: 'reference', header: 'Referência', width: 14 },
          { key: 'name', header: 'Nome', width: 24 },
          { key: 'age', header: 'Idade', width: 6, kind: 'number' },
          { key: 'gender', header: 'Género', width: 9 },
          { key: 'phone', header: 'Telefone', width: 13 },
          { key: 'courseName', header: 'Curso', width: 22 },
          { key: 'campus', header: 'Pólo', width: 13 },
          { key: 'classCode', header: 'Turma', width: 15 },
          { key: 'status', header: 'Estado', width: 10 },
        ],
        rows: rows.map((r) => ({
          ...r,
          age: ageAt(r.birthDate) ?? r.age,
          campus: r.campus?.name,
          classCode: r.classGroup?.code ?? (r.waitlisted ? 'Lista de espera' : null),
          status: REGISTRATION_LABELS[r.status],
        })),
        summary: [
          ['Total', rows.length],
          ['Pendentes', count(rows, 'PENDENTE')],
          ['Em análise', count(rows, 'EM_ANALISE')],
          ['Aceites', count(rows, 'ACEITE')],
          ['Recusadas', count(rows, 'RECUSADA')],
          ['Em lista de espera', rows.filter((r) => r.waitlisted).length],
        ],
      };
    },
  },
  {
    key: 'procura-cursos',
    title: 'Procura por curso',
    description: 'Número de inscrições por curso no período, por estado.',
    icon: 'leaderboard',
    group: 'Académico',
    permissions: ['registrations.export', 'courses.manage'],
    dateRange: true,
    dateLabel: 'Data de inscrição',
    filters: [{ key: 'campusId', label: 'Pólo', source: 'campuses' }],
    async build(db, p) {
      const rows = await db.registration.findMany({
        where: {
          createdAt: inRange(p),
          ...(p.filters.campusId ? { campusId: p.filters.campusId } : {}),
        },
        select: { courseName: true, area: true, status: true, waitlisted: true },
      });
      const byCourse = new Map<string, Record<string, unknown> & { total: number }>();
      for (const r of rows) {
        const item =
          byCourse.get(r.courseName) ??
          ({
            course: r.courseName,
            area: r.area,
            total: 0,
            PENDENTE: 0,
            EM_ANALISE: 0,
            ACEITE: 0,
            RECUSADA: 0,
            waitlisted: 0,
          } as Record<string, unknown> & { total: number });
        item.total++;
        item[r.status] = (item[r.status] as number) + 1;
        if (r.waitlisted) item.waitlisted = (item.waitlisted as number) + 1;
        byCourse.set(r.courseName, item);
      }
      const data = [...byCourse.values()].sort((a, b) => b.total - a.total);
      return {
        title: 'Procura por curso',
        subtitle: 'Inscrições agrupadas por curso.',
        landscape: true,
        columns: [
          { key: 'course', header: 'Curso', width: 30 },
          { key: 'area', header: 'Área', width: 22 },
          { key: 'total', header: 'Total', width: 8, kind: 'number' },
          { key: 'PENDENTE', header: 'Pendentes', width: 9, kind: 'number' },
          { key: 'EM_ANALISE', header: 'Em análise', width: 9, kind: 'number' },
          { key: 'ACEITE', header: 'Aceites', width: 9, kind: 'number' },
          { key: 'RECUSADA', header: 'Recusadas', width: 9, kind: 'number' },
          { key: 'waitlisted', header: 'Em espera', width: 9, kind: 'number' },
        ],
        rows: data,
        summary: [
          ['Inscrições', rows.length],
          ['Cursos com procura', data.length],
          ['Taxa de aceitação', pct(count(rows, 'ACEITE'), rows.length)],
        ],
      };
    },
  },
  {
    key: 'turmas',
    title: 'Turmas e ocupação',
    description: 'Turmas cujo período começa no intervalo, com vagas, ocupação e estado.',
    icon: 'groups',
    group: 'Académico',
    permissions: ['classes.read'],
    dateRange: true,
    dateLabel: 'Início do período',
    filters: [
      { key: 'campusId', label: 'Pólo', source: 'campuses' },
      { key: 'periodId', label: 'Período', source: 'periods' },
      { key: 'status', label: 'Estado', source: 'classStatus' },
    ],
    async build(db, p) {
      const f = p.filters;
      const classes = await db.classGroup.findMany({
        where: {
          period: { startsAt: inRange(p) },
          ...(f.campusId ? { campusId: f.campusId } : {}),
          ...(f.periodId ? { periodId: f.periodId } : {}),
          ...((CLASS_STATUSES as readonly string[]).includes(f.status) ? { status: f.status } : {}),
        },
        include: { course: true, campus: true, period: true },
        orderBy: [{ period: { startsAt: 'asc' } }, { code: 'asc' }],
      });
      const taken = await seatsTaken(
        db,
        classes.map((c) => c.id),
      );
      const rows = classes.map((c) => {
        const used = taken.get(c.id) ?? 0;
        return {
          code: c.code,
          course: c.course.name,
          campus: c.campus.name,
          period: c.period.name,
          startsAt: c.period.startsAt,
          shift: SHIFTS[c.shift as keyof typeof SHIFTS] ?? c.shift,
          capacity: c.capacity,
          used,
          free: Math.max(0, c.capacity - used),
          rate: c.capacity ? used / c.capacity : 0,
          status: CLASS_LABELS[c.status] ?? c.status,
        };
      });
      const capacity = rows.reduce((s, r) => s + r.capacity, 0);
      const used = rows.reduce((s, r) => s + r.used, 0);
      return {
        title: 'Turmas e ocupação',
        landscape: true,
        columns: [
          { key: 'code', header: 'Código', width: 15 },
          { key: 'course', header: 'Curso', width: 24 },
          { key: 'campus', header: 'Pólo', width: 14 },
          { key: 'period', header: 'Período', width: 14 },
          { key: 'startsAt', header: 'Início', width: 10, kind: 'date' },
          { key: 'shift', header: 'Turno', width: 10 },
          { key: 'capacity', header: 'Vagas', width: 7, kind: 'number' },
          { key: 'used', header: 'Ocupadas', width: 8, kind: 'number' },
          { key: 'free', header: 'Livres', width: 7, kind: 'number' },
          { key: 'rate', header: 'Ocupação', width: 8, kind: 'percent' },
          { key: 'status', header: 'Estado', width: 13 },
        ],
        rows,
        summary: [
          ['Turmas', rows.length],
          ['Vagas', capacity],
          ['Ocupadas', used],
          ['Taxa de ocupação', pct(used, capacity)],
        ],
      };
    },
  },
  {
    key: 'lista-turma',
    title: 'Lista de estudantes da turma',
    description: 'Pauta nominal de uma turma, pronta para arquivo e assinatura.',
    icon: 'format_list_numbered',
    group: 'Académico',
    permissions: ['registrations.export'],
    dateRange: false,
    filters: [{ key: 'classId', label: 'Turma', source: 'classes', required: true }],
    async build(db, p) {
      const group = await db.classGroup.findUnique({
        where: { id: p.filters.classId },
        include: {
          course: true,
          campus: true,
          period: true,
          registrations: { where: { status: { in: SEAT_STATUSES } }, orderBy: { name: 'asc' } },
        },
      });
      if (!group) return { title: 'Lista de estudantes da turma', columns: [], rows: [] };
      return {
        title: `Lista de estudantes — ${group.code}`,
        subtitle: `${group.course.name} · ${group.campus.name} · ${SHIFTS[group.shift as keyof typeof SHIFTS] ?? group.shift}${group.schedule ? ` (${group.schedule})` : ''} · Período ${group.period.name}`,
        columns: [
          { key: 'n', header: 'N.º', width: 5, kind: 'number', align: 'center' },
          { key: 'name', header: 'Nome completo', width: 30 },
          { key: 'birthDate', header: 'Nascimento', width: 11, kind: 'date' },
          { key: 'document', header: 'Documento', width: 16 },
          { key: 'phone', header: 'Telefone', width: 14 },
          { key: 'status', header: 'Estado', width: 10 },
        ],
        rows: group.registrations.map((r, i) => ({
          n: i + 1,
          name: r.name,
          birthDate: r.birthDate,
          document: r.documentNumber ? `${r.documentType ?? ''} ${r.documentNumber}`.trim() : null,
          phone: r.phone,
          status: REGISTRATION_LABELS[r.status],
        })),
        summary: [
          ['Vagas', group.capacity],
          ['Estudantes', group.registrations.length],
          ['Aceites', count(group.registrations, 'ACEITE')],
          ['Início', group.period.startsAt.toLocaleDateString('pt-PT')],
        ],
        signatures: ['O(A) Formador(a)', 'A Secretaria Académica', 'A Direcção'],
      };
    },
  },
  {
    key: 'lista-espera',
    title: 'Lista de espera',
    description: 'Candidatos sem vaga, por ordem de chegada.',
    icon: 'schedule',
    group: 'Académico',
    permissions: ['registrations.export'],
    dateRange: true,
    dateLabel: 'Data de inscrição',
    filters: [
      { key: 'campusId', label: 'Pólo', source: 'campuses' },
      { key: 'courseId', label: 'Curso', source: 'courses' },
    ],
    async build(db, p) {
      const rows = await db.registration.findMany({
        where: {
          waitlisted: true,
          status: { in: SEAT_STATUSES },
          createdAt: inRange(p),
          ...(p.filters.campusId ? { campusId: p.filters.campusId } : {}),
          ...(p.filters.courseId ? { courseId: p.filters.courseId } : {}),
        },
        include: { campus: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: MAX_ROWS,
      });
      const now = Date.now();
      return {
        title: 'Lista de espera',
        subtitle: 'Ordenada por data de inscrição (os primeiros têm prioridade).',
        columns: [
          { key: 'position', header: 'Ordem', width: 6, kind: 'number', align: 'center' },
          { key: 'createdAt', header: 'Inscrito em', width: 11, kind: 'date' },
          { key: 'name', header: 'Nome', width: 24 },
          { key: 'phone', header: 'Telefone', width: 13 },
          { key: 'courseName', header: 'Curso', width: 24 },
          { key: 'campus', header: 'Pólo', width: 14 },
          { key: 'days', header: 'Dias em espera', width: 9, kind: 'number' },
        ],
        rows: rows.map((r, i) => ({
          ...r,
          position: i + 1,
          campus: r.campus?.name,
          days: Math.floor((now - r.createdAt.getTime()) / 864e5),
        })),
        summary: [['Candidatos em espera', rows.length]],
      };
    },
  },
  {
    key: 'mensagens',
    title: 'Mensagens de contacto',
    description: 'Pedidos recebidos pelo formulário «Fale connosco» e o seu tratamento.',
    icon: 'forum',
    group: 'Comunicação',
    permissions: ['messages.read'],
    dateRange: true,
    dateLabel: 'Data de recepção',
    filters: [
      { key: 'status', label: 'Estado', source: 'messageStatus' },
      { key: 'category', label: 'Categoria', source: 'messageCategory' },
    ],
    async build(db, p) {
      const f = p.filters;
      const rows = await db.contactMessage.findMany({
        where: {
          createdAt: inRange(p),
          ...((MESSAGE_STATUSES as readonly string[]).includes(f.status)
            ? { status: f.status as never }
            : {}),
          ...(f.category ? { category: f.category } : {}),
        },
        include: {
          _count: { select: { replies: true } },
          assignedAdmin: { select: { email: true, displayName: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: MAX_ROWS,
      });
      return {
        title: 'Mensagens de contacto',
        landscape: true,
        columns: [
          { key: 'createdAt', header: 'Recebida', width: 12, kind: 'datetime' },
          { key: 'name', header: 'Nome', width: 18 },
          { key: 'email', header: 'E-mail', width: 22 },
          { key: 'category', header: 'Categoria', width: 14 },
          { key: 'subject', header: 'Assunto', width: 26 },
          { key: 'status', header: 'Estado', width: 11 },
          { key: 'replies', header: 'Respostas', width: 8, kind: 'number' },
          { key: 'assigned', header: 'Tratada por', width: 16 },
        ],
        rows: rows.map((r) => ({
          ...r,
          status: MESSAGE_LABELS[r.status],
          replies: r._count.replies,
          assigned: r.assignedAdmin?.displayName || r.assignedAdmin?.email,
        })),
        summary: [
          ['Recebidas', rows.length],
          ['Respondidas', count(rows, 'RESPONDIDA')],
          ['Por ler', count(rows, 'NAO_LIDA')],
          ['Taxa de resposta', pct(count(rows, 'RESPONDIDA'), rows.length)],
        ],
      };
    },
  },
  {
    key: 'conteudos',
    title: 'Publicações no site',
    description: 'Notícias, eventos e álbuns criados no período, com autor e estado.',
    icon: 'newspaper',
    group: 'Comunicação',
    permissions: ['news.manage', 'events.manage', 'gallery.manage'],
    dateRange: true,
    dateLabel: 'Data de criação',
    filters: [{ key: 'kind', label: 'Tipo', source: 'contentKinds' }],
    async build(db, p) {
      const kind = p.filters.kind;
      const author = { select: { email: true, displayName: true } };
      const where = { createdAt: inRange(p) };
      const [news, events, albums] = await Promise.all([
        !kind || kind === 'news'
          ? db.news.findMany({ where, include: { author, category: true } })
          : [],
        !kind || kind === 'events' ? db.event.findMany({ where, include: { author } }) : [],
        !kind || kind === 'albums'
          ? db.album.findMany({ where, include: { author, _count: { select: { photos: true } } } })
          : [],
      ]);
      type Row = {
        kind: string;
        title: string;
        detail: string | null;
        published: string;
        author: string;
        createdAt: Date;
      };
      const name = (a: { email: string; displayName: string }) => a.displayName || a.email;
      const rows: Row[] = [
        ...news.map((n) => ({
          kind: CONTENT_LABELS.news,
          title: n.title,
          detail: n.category?.name ?? null,
          published: n.published ? 'Publicado' : 'Rascunho',
          author: name(n.author),
          createdAt: n.createdAt,
        })),
        ...events.map((e) => ({
          kind: CONTENT_LABELS.events,
          title: e.title,
          detail: `${e.startsAt.toLocaleDateString('pt-PT')}${e.location ? ` · ${e.location}` : ''}`,
          published: e.published ? 'Publicado' : 'Rascunho',
          author: name(e.author),
          createdAt: e.createdAt,
        })),
        ...albums.map((a) => ({
          kind: CONTENT_LABELS.albums,
          title: a.title,
          detail: `${a._count.photos} fotografias`,
          published: a.published ? 'Publicado' : 'Rascunho',
          author: name(a.author),
          createdAt: a.createdAt,
        })),
      ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return {
        title: 'Publicações no site',
        landscape: true,
        columns: [
          { key: 'createdAt', header: 'Criado em', width: 11, kind: 'date' },
          { key: 'kind', header: 'Tipo', width: 9 },
          { key: 'title', header: 'Título', width: 34 },
          { key: 'detail', header: 'Detalhe', width: 20 },
          { key: 'published', header: 'Estado', width: 10 },
          { key: 'author', header: 'Autor', width: 18 },
        ],
        rows,
        summary: [
          ['Notícias', news.length],
          ['Eventos', events.length],
          ['Álbuns', albums.length],
          ['Publicados', rows.filter((r) => r.published === 'Publicado').length],
        ],
      };
    },
  },
  {
    key: 'auditoria',
    title: 'Registo de auditoria',
    description: 'Todas as acções feitas na área administrativa: quem, o quê e quando.',
    icon: 'policy',
    group: 'Sistema',
    permissions: ['audit.read'],
    dateRange: true,
    dateLabel: 'Data da acção',
    filters: [
      { key: 'module', label: 'Módulo', source: 'auditModules' },
      { key: 'adminId', label: 'Utilizador', source: 'admins' },
    ],
    async build(db, p) {
      const where: Prisma.AuditLogWhereInput = {
        createdAt: inRange(p),
        ...(p.filters.module ? { module: p.filters.module } : {}),
        ...(p.filters.adminId ? { adminId: p.filters.adminId } : {}),
      };
      const logs = await db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: MAX_ROWS,
      });
      const admins = await db.adminUser.findMany({
        where: { id: { in: [...new Set(logs.map((l) => l.adminId))] } },
        select: { id: true, email: true, displayName: true },
      });
      const who = (id: string) => {
        const a = admins.find((x) => x.id === id);
        return a ? a.displayName || a.email : 'Conta eliminada';
      };
      const detail = (m: Prisma.JsonValue | null) => {
        if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
        return Object.entries(m)
          .filter(
            ([k, v]) =>
              !HIDDEN_DETAIL_KEYS.has(k) &&
              v !== null &&
              v !== undefined &&
              !(Array.isArray(v) && !v.length),
          )
          .map(([k, v]) => `${DETAIL_LABELS[k] ?? k}: ${detailValue(k, v)}`)
          .join(' · ')
          .slice(0, 300);
      };
      return {
        title: 'Registo de auditoria',
        subtitle: 'Registo inalterável das acções administrativas.',
        landscape: true,
        columns: [
          { key: 'createdAt', header: 'Data e hora', width: 13, kind: 'datetime' },
          { key: 'who', header: 'Utilizador', width: 18 },
          { key: 'action', header: 'Acção', width: 22 },
          { key: 'module', header: 'Módulo', width: 11 },
          { key: 'targetId', header: 'Referência', width: 18 },
          { key: 'detail', header: 'Detalhes', width: 30 },
        ],
        rows: logs.map((l) => ({
          createdAt: l.createdAt,
          who: who(l.adminId),
          action: actionLabel(l.action),
          module: MODULE_LABELS[l.module] ?? l.module,
          targetId: l.targetId,
          detail: detail(l.metadata),
        })),
        summary: [
          ['Acções registadas', logs.length],
          ['Utilizadores envolvidos', admins.length],
        ],
      };
    },
  },
  {
    key: 'equipa',
    title: 'Utilizadores e permissões',
    description: 'Situação actual das contas administrativas, funções e acessos.',
    icon: 'admin_panel_settings',
    group: 'Sistema',
    permissions: ['users.manage', 'audit.read'],
    dateRange: false,
    filters: [],
    async build(db) {
      const users = await db.adminUser.findMany({
        include: { role: true },
        orderBy: [{ isSuperAdmin: 'desc' }, { email: 'asc' }],
      });
      return {
        title: 'Utilizadores e permissões',
        landscape: true,
        columns: [
          { key: 'name', header: 'Nome', width: 18 },
          { key: 'email', header: 'E-mail', width: 24 },
          { key: 'role', header: 'Função', width: 18 },
          { key: 'state', header: 'Estado', width: 10 },
          { key: 'permissions', header: 'Permissões adicionais', width: 30 },
          { key: 'lastLoginAt', header: 'Último acesso', width: 13, kind: 'datetime' },
          { key: 'createdAt', header: 'Criada em', width: 11, kind: 'date' },
        ],
        rows: users.map((u) => ({
          name: u.displayName || null,
          email: u.email,
          role: u.isSuperAdmin ? 'Administrador principal' : (u.role?.name ?? 'Sem função'),
          state: u.active ? 'Activa' : 'Desactivada',
          permissions: u.permissions.join(', ') || null,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
        })),
        summary: [
          ['Contas', users.length],
          ['Activas', users.filter((u) => u.active).length],
          ['Desactivadas', users.filter((u) => !u.active).length],
        ],
      };
    },
  },
];

/** Options for each filter source, used to build the admin forms and to label applied filters. */
export async function filterOptions(db: PrismaService, sources: FilterSource[]) {
  const want = new Set(sources);
  const out: Partial<Record<FilterSource, { value: string; label: string }[]>> = {};
  if (want.has('registrationStatus'))
    out.registrationStatus = Object.entries(REGISTRATION_LABELS).map(([value, label]) => ({
      value,
      label,
    }));
  if (want.has('messageStatus'))
    out.messageStatus = Object.entries(MESSAGE_LABELS).map(([value, label]) => ({ value, label }));
  if (want.has('messageCategory'))
    out.messageCategory = CONTACT_CATEGORIES.map((c) => ({ value: c, label: c }));
  if (want.has('classStatus'))
    out.classStatus = Object.entries(CLASS_LABELS).map(([value, label]) => ({ value, label }));
  if (want.has('contentKinds'))
    out.contentKinds = Object.entries(CONTENT_LABELS).map(([value, label]) => ({ value, label }));
  if (want.has('auditModules'))
    out.auditModules = Object.entries(MODULE_LABELS).map(([value, label]) => ({ value, label }));
  const [campuses, courses, periods, classes, admins] = await Promise.all([
    want.has('campuses') ? db.campus.findMany({ orderBy: { name: 'asc' } }) : [],
    want.has('courses') ? db.course.findMany({ orderBy: { name: 'asc' } }) : [],
    want.has('periods') ? db.period.findMany({ orderBy: { startsAt: 'desc' } }) : [],
    want.has('classes')
      ? db.classGroup.findMany({
          include: { course: true, campus: true },
          orderBy: { code: 'asc' },
        })
      : [],
    want.has('admins') ? db.adminUser.findMany({ orderBy: { email: 'asc' } }) : [],
  ]);
  if (want.has('campuses')) out.campuses = campuses.map((c) => ({ value: c.id, label: c.name }));
  if (want.has('courses')) out.courses = courses.map((c) => ({ value: c.id, label: c.name }));
  if (want.has('periods')) out.periods = periods.map((p) => ({ value: p.id, label: p.name }));
  if (want.has('classes'))
    out.classes = classes.map((c) => ({
      value: c.id,
      label: `${c.code} — ${c.course.name} (${c.campus.name})`,
    }));
  if (want.has('admins'))
    out.admins = admins.map((a) => ({ value: a.id, label: a.displayName || a.email }));
  return out;
}
