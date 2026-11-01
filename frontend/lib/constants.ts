/** Labels, colours and icons shared by the admin. Keys mirror backend/src/constants.ts. */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';
export type StatusMeta = { label: string; tone: Tone; icon: string };

export const REGISTRATION_STATUS: Record<string, StatusMeta> = {
  PENDENTE: { label: 'Pendente', tone: 'warning', icon: 'hourglass_top' },
  EM_ANALISE: { label: 'Em análise', tone: 'info', icon: 'manage_search' },
  ACEITE: { label: 'Aceite', tone: 'success', icon: 'check_circle' },
  RECUSADA: { label: 'Recusada', tone: 'danger', icon: 'cancel' },
};

export const MESSAGE_STATUS: Record<string, StatusMeta> = {
  NAO_LIDA: { label: 'Não lida', tone: 'brand', icon: 'mark_email_unread' },
  LIDA: { label: 'Lida', tone: 'neutral', icon: 'drafts' },
  EM_TRATAMENTO: { label: 'Em tratamento', tone: 'warning', icon: 'pending' },
  RESPONDIDA: { label: 'Respondida', tone: 'success', icon: 'reply' },
  ARQUIVADA: { label: 'Arquivada', tone: 'neutral', icon: 'inventory_2' },
};

export const EVENT_STATUS: Record<string, StatusMeta> = {
  AGENDADO: { label: 'Agendado', tone: 'info', icon: 'event' },
  EM_CURSO: { label: 'Em curso', tone: 'warning', icon: 'play_circle' },
  REALIZADO: { label: 'Realizado', tone: 'success', icon: 'event_available' },
  CANCELADO: { label: 'Cancelado', tone: 'danger', icon: 'event_busy' },
};

export const PUBLISHED: StatusMeta = { label: 'Publicado', tone: 'success', icon: 'public' };
export const DRAFT: StatusMeta = { label: 'Rascunho', tone: 'neutral', icon: 'edit_note' };
export const ENROLLMENT_OPEN: StatusMeta = {
  label: 'Inscrições abertas',
  tone: 'info',
  icon: 'lock_open',
};
export const ENROLLMENT_CLOSED: StatusMeta = {
  label: 'Inscrições fechadas',
  tone: 'neutral',
  icon: 'lock',
};

/** Chart colours: project greens for single series; status hues always shown with icon + label. */
export const CHART = {
  primary: '#234d40',
  secondary: '#a4bf55',
  grid: '#e4e8df',
  tone: {
    success: '#2f7d4a',
    warning: '#c98a0c',
    danger: '#b8322a',
    info: '#3f7fc0',
    neutral: '#8a948f',
    brand: '#234d40',
  } satisfies Record<Tone, string>,
};

export const CONTACT_CATEGORIES = [
  'Informações gerais',
  'Inscrições',
  'Cursos',
  'Serviços académicos',
  'Parcerias',
  'Outros',
];

export type Permission =
  | 'dashboard.read'
  | 'registrations.read'
  | 'registrations.manage'
  | 'courses.manage'
  | 'news.manage'
  | 'events.manage'
  | 'gallery.manage'
  | 'messages.read'
  | 'messages.manage'
  | 'messages.reply'
  | 'settings.manage'
  | 'users.manage';

export const CONTENT_PERMISSIONS: Permission[] = ['news.manage', 'events.manage', 'gallery.manage'];

export type Badges = { pendingRegistrations: number; unreadMessages: number };

export type NavItem = {
  href: string;
  icon: string;
  label: string;
  /** Any of these permissions grants access; empty = every admin. */
  permissions: Permission[];
  badge?: keyof Badges;
};

export const ADMIN_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Geral',
    items: [
      { href: '/admin', icon: 'space_dashboard', label: 'Painel', permissions: ['dashboard.read'] },
    ],
  },
  {
    group: 'Académico',
    items: [
      {
        href: '/admin/inscricoes',
        icon: 'assignment_ind',
        label: 'Inscrições',
        permissions: ['registrations.read'],
        badge: 'pendingRegistrations',
      },
      { href: '/admin/cursos', icon: 'school', label: 'Cursos', permissions: ['courses.manage'] },
    ],
  },
  {
    group: 'Comunicação',
    items: [
      {
        href: '/admin/conteudos',
        icon: 'newspaper',
        label: 'Conteúdos',
        permissions: CONTENT_PERMISSIONS,
      },
      {
        href: '/admin/mensagens',
        icon: 'forum',
        label: 'Mensagens',
        permissions: ['messages.read'],
        badge: 'unreadMessages',
      },
    ],
  },
  {
    group: 'Sistema',
    items: [
      {
        href: '/admin/administradores',
        icon: 'admin_panel_settings',
        label: 'Equipa e funções',
        permissions: ['users.manage'],
      },
      {
        href: '/admin/configuracoes',
        icon: 'tune',
        label: 'Configurações',
        permissions: ['settings.manage'],
      },
    ],
  },
];

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
export const MAX_IMAGE_MB = 10;
export const PAGE_SIZE = 15;
