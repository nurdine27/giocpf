/** Single source of truth for permissions, roles, statuses and limits used by the API. */

export const PERMISSIONS = [
  { key: 'dashboard.read', label: 'Ver painel e estatísticas', group: 'Geral' },
  { key: 'registrations.read', label: 'Consultar inscrições', group: 'Académico' },
  {
    key: 'registrations.manage',
    label: 'Alterar estado e turma de inscrições',
    group: 'Académico',
  },
  { key: 'registrations.export', label: 'Exportar listas de estudantes', group: 'Académico' },
  { key: 'courses.manage', label: 'Gerir cursos', group: 'Académico' },
  { key: 'classes.read', label: 'Consultar turmas e períodos', group: 'Académico' },
  { key: 'classes.manage', label: 'Gerir turmas, vagas, períodos e pólos', group: 'Académico' },
  { key: 'news.manage', label: 'Gerir notícias', group: 'Conteúdos' },
  { key: 'events.manage', label: 'Gerir eventos', group: 'Conteúdos' },
  { key: 'gallery.manage', label: 'Gerir galeria', group: 'Conteúdos' },
  { key: 'messages.read', label: 'Ler mensagens', group: 'Comunicação' },
  { key: 'messages.manage', label: 'Alterar estado das mensagens', group: 'Comunicação' },
  { key: 'messages.reply', label: 'Responder mensagens', group: 'Comunicação' },
  { key: 'settings.manage', label: 'Configurações institucionais', group: 'Sistema' },
  { key: 'users.manage', label: 'Gerir administradores e funções', group: 'Sistema' },
  { key: 'audit.read', label: 'Consultar registo de auditoria', group: 'Sistema' },
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
    description: 'Gere inscrições, cursos, turmas e períodos e consulta as mensagens.',
    permissions: [
      'dashboard.read',
      'registrations.read',
      'registrations.manage',
      'registrations.export',
      'courses.manage',
      'classes.read',
      'classes.manage',
      'messages.read',
    ],
  },
  {
    name: 'Formador',
    description: 'Consulta as turmas e as listas de estudantes.',
    permissions: ['dashboard.read', 'registrations.read', 'registrations.export', 'classes.read'],
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
    description: 'Acesso apenas de leitura ao painel, inscrições, turmas e mensagens.',
    permissions: ['dashboard.read', 'registrations.read', 'classes.read', 'messages.read'],
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

/** Campuses created on first start-up when none exist. Managed afterwards in the admin. */
export const DEFAULT_CAMPUSES = [
  { name: 'Nacala', city: 'Nacala' },
  { name: 'Cidade de Nampula', city: 'Nampula' },
];

export const SHIFTS = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
  FIM_DE_SEMANA: 'Fim de semana',
} as const;
export type Shift = keyof typeof SHIFTS;

/** ABERTA accepts new students; the others never receive automatic placements. */
export const CLASS_STATUSES = ['ABERTA', 'FECHADA', 'EM_CURSO', 'CONCLUIDA', 'CANCELADA'] as const;
export type ClassStatus = (typeof CLASS_STATUSES)[number];

/** Registration statuses that occupy a seat in a class. */
export const SEAT_STATUSES: RegistrationStatus[] = ['PENDENTE', 'EM_ANALISE', 'ACEITE'];

export const MIN_STUDENT_AGE = 14;
export const MAX_STUDENT_AGE = 99;

/** Options shown in the public registration form (served by GET /registrations/form-options). */
export const STUDENT_OPTIONS = {
  genders: ['Feminino', 'Masculino', 'Prefiro não dizer'],
  documentTypes: ['Bilhete de Identidade', 'Passaporte', 'Cédula pessoal', 'DIRE', 'Outro'],
  educationLevels: [
    'Ensino primário',
    '7.ª classe',
    '10.ª classe',
    '12.ª classe',
    'Técnico médio',
    'Bacharelato / Licenciatura',
    'Mestrado ou superior',
  ],
  occupations: [
    'Estudante',
    'Empregado(a)',
    'Trabalhador(a) por conta própria',
    'Desempregado(a)',
    'Outro',
  ],
  referralSources: [
    'Facebook',
    'Instagram',
    'WhatsApp',
    'Rádio ou televisão',
    'Amigo ou familiar',
    'Escola ou empresa',
    'Outro',
  ],
};
