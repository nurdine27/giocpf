import { API_BASE } from './api-url';

/** Defaults used when the institution settings have not been filled in the admin. */
export const SITE = {
  name: 'GIO Centro de Formação',
  shortName: 'GIO',
  tagline: 'Cursos práticos e profissionalizantes de curta duração.',
  email: 'giocentrodeformacao@gmail.com',
  phone: '+258 86 726 8483',
  whatsapp: '258867268483',
  address: '',
  website: '',
  instagram: 'https://www.instagram.com/giocentrodeformacao/',
  facebook: 'https://www.facebook.com/search/top?q=Gio%20Centro%20de%20Forma%C3%A7%C3%A3o',
  logoUrl: '',
};

export type SiteInfo = typeof SITE;

export const NAV_LINKS = [
  { href: '/sobre', label: 'Sobre nós' },
  { href: '/cursos', label: 'Cursos' },
  { href: '/noticias', label: 'Notícias' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/galeria', label: 'Galeria' },
  { href: '/contactos', label: 'Contactos' },
];

export const IDENTITY = [
  {
    title: 'Missão',
    icon: 'flag',
    text: 'Promover a capacitação técnica, o desenvolvimento humano e a transformação social, por meio de práticas educativas inovadoras.',
  },
  {
    title: 'Visão',
    icon: 'visibility',
    text: 'Estimular competências técnicas e socio-emocionais, promovendo a inclusão, a ética profissional e a responsabilidade social, e fortalecendo o desenvolvimento sustentável da comunidade local.',
  },
  {
    title: 'Valores',
    icon: 'diversity_3',
    text: 'Excelência · Inovação · Ética e integridade · Inclusão · Diversidade',
  },
];

export function whatsappLink(number: string) {
  return `https://wa.me/${number.replace(/\D/g, '')}`;
}

/** Institution settings merged over the defaults. Safe to call from server components. */
export async function getSiteInfo(): Promise<SiteInfo> {
  try {
    const r = await fetch(`${API_BASE}/content/settings`, { next: { revalidate: 300 } });
    if (!r.ok) return SITE;
    const remote: Record<string, unknown> = await r.json();
    const merged = { ...SITE };
    for (const key of Object.keys(SITE) as (keyof SiteInfo)[]) {
      const value =
        key === 'name'
          ? remote.institutionName
          : key === 'email'
            ? remote.institutionEmail
            : remote[key];
      if (typeof value === 'string' && value.trim()) merged[key] = value.trim();
    }
    return merged;
  } catch {
    return SITE;
  }
}
