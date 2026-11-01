/** Single source of truth for permissions, roles, statuses and limits used by the API. */

export const PERMISSIONS = [
  { key: 'dashboard.read', label: 'Ver painel e estatísticas', group: 'Geral' },
  { key: 'registrations.read', label: 'Consultar inscrições', group: 'Académico' },
  { key: 'registrations.manage', label: 'Alterar estado de inscrições', group: 'Académico' },
  { key: 'courses.manage', label: 'Gerir cursos', group: 'Académico' },
  { key: 'news.manage', label: 'Gerir notícias', group: 'Conteúdos' },
  { key: 'events.manage', label: 'Gerir eventos', group: 'Conteúdos' },
  { key: 'gallery.manage', label: 'Gerir galeria', group: 'Conteúdos' },
  { key: 'messages.read', label: 'Ler mensagens', group: 'Comunicação' },
  { key: 'messages.manage', label: 'Alterar estado das mensagens', group: 'Comunicação' },
  { key: 'messages.reply', label: 'Responder mensagens', group: 'Comunicação' },
  { key: 'settings.manage', label: 'Configurações institucionais', group: 'Sistema' },
  { key: 'users.manage', label: 'Gerir administradores e funções', group: 'Sistema' },
] as const;

export type Permission = (typeof PERMISSIONS)[number]['key'];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as Permission[];
export const CONTENT_PERMISSIONS: Permission[] = ['news.manage', 'events.manage', 'gallery.manage'];

export function isPermission(value: string): value is Permission {
  return (PERMISSION_KEYS as string[]).includes(value);
}

/** Roles created automatically on start-up. Their permissions are kept in sync with this list. */
export const SYSTEM_ROLES: { name: string; description: string; permissions: Permission[] }[] = [
  {
    name: 'Administrador',
    description: 'Acesso completo a todas as áreas da gestão.',
    permissions: PERMISSION_KEYS,
  },
  {
    name: 'Secretaria académica',
    description: 'Gere inscrições e cursos e consulta as mensagens.',
    permissions: [
      'dashboard.read',
      'registrations.read',
      'registrations.manage',
      'courses.manage',
      'messages.read',
    ],
  },
  {
    name: 'Comunicação',
    description: 'Publica notícias, eventos e álbuns e responde às mensagens.',
    permissions: [
      'dashboard.read',
      'news.manage',
      'events.manage',
      'gallery.manage',
      'messages.read',
      'messages.manage',
      'messages.reply',
    ],
  },
  {
    name: 'Consulta',
    description: 'Acesso apenas de leitura ao painel, inscrições e mensagens.',
    permissions: ['dashboard.read', 'registrations.read', 'messages.read'],
  },
];

export const REGISTRATION_STATUSES = ['PENDENTE', 'EM_ANALISE', 'ACEITE', 'RECUSADA'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const MESSAGE_STATUSES = [
  'NAO_LIDA',
  'LIDA',
  'EM_TRATAMENTO',
  'RESPONDIDA',
  'ARQUIVADA',
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const EVENT_STATUSES = ['AGENDADO', 'EM_CURSO', 'REALIZADO', 'CANCELADO'] as const;

export const CONTACT_CATEGORIES = [
  'Informações gerais',
  'Inscrições',
  'Cursos',
  'Serviços académicos',
  'Parcerias',
  'Outros',
] as const;

export const CONTENT_KINDS = {
  news: { model: 'news', permission: 'news.manage' },
  events: { model: 'event', permission: 'events.manage' },
  albums: { model: 'album', permission: 'gallery.manage' },
} as const;
export type ContentKind = keyof typeof CONTENT_KINDS;

export function isContentKind(value: string): value is ContentKind {
  return value in CONTENT_KINDS;
}

/** Institution settings editable in the admin. Public ones are exposed to the website. */
export const SETTING_KEYS = [
  'institutionName',
  'institutionEmail',
  'phone',
  'whatsapp',
  'address',
  'logoUrl',
  'logoPublicId',
  'website',
  'facebook',
  'instagram',
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];
export const PUBLIC_SETTING_KEYS: SettingKey[] = [
  'institutionName',
  'institutionEmail',
  'phone',
  'whatsapp',
  'address',
  'logoUrl',
  'website',
  'facebook',
  'instagram',
];

export const UPLOAD = {
  maxFileSize: 10 * 1024 * 1024,
  maxFiles: 20,
  mimePattern: /^image\/(jpeg|png|webp|gif)$/,
  formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  rootFolder: 'gio-cpf',
} as const;

/** Upload folders and who may write to each one. `null` means any signed-in admin. */
export const UPLOAD_FOLDERS: Record<string, Permission[] | null> = {
  conteudos: CONTENT_PERMISSIONS,
  cursos: ['courses.manage'],
  perfis: null,
  instituicao: ['settings.manage'],
};

export const MAX_PHOTOS_PER_ITEM = 100;
export const SESSION_COOKIE = 'gio_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const OTP_TTL_MS = 10 * 60 * 1000;
