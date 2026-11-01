import type { MetadataRoute } from 'next';
import { API_BASE } from '@/lib/api-url';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || 'https://giocentrodeformacao.co.mz';
  const paths = ['', '/cursos', '/sobre', '/contactos', '/inscricao', '/politica-de-privacidade','/noticias','/eventos','/galeria'];
  try { for(const [endpoint,key,route] of [['news','items','noticias'],['events','items','eventos'],['albums','items','galeria']]) { let page=1,pages=1; do { const r=await fetch(`${API_BASE}/content/${endpoint}?page=${page}`,{next:{revalidate:3600}}); if(!r.ok)break; const result=await r.json(); for(const item of result[key]??[]) paths.push(`/${route}/${item.slug}`); pages=Number(result.pages)||1; page++; } while(page<=pages && page<=1000); } }catch{}
  return paths.map(
    (path) => ({
      url: new URL(path, base).toString(),
      lastModified: new Date(),
      changeFrequency: path === '/cursos' ? 'weekly' : 'monthly',
      priority: path === '' ? 1 : 0.7,
    }),
  );
}
