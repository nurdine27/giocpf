import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL || 'https://giocentrodeformacao.co.mz';
  return ['', '/cursos', '/sobre', '/contactos', '/inscricao', '/politica-de-privacidade'].map(
    (path) => ({
      url: new URL(path, base).toString(),
      lastModified: new Date(),
      changeFrequency: path === '/cursos' ? 'weekly' : 'monthly',
      priority: path === '' ? 1 : 0.7,
    }),
  );
}
