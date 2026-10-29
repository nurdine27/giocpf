import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL || 'https://giocentrodeformacao.co.mz';
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/admin/' },
    sitemap: new URL('/sitemap.xml', base).toString(),
  };
}
