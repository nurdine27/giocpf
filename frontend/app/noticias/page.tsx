import { API_BASE } from '@/lib/api-url';
import Image from 'next/image';
import Link from 'next/link';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Notícias',description:'Notícias e actividades do GIO CPF.'};
const api=API_BASE;
type NewsItem={slug:string;title:string;summary:string;coverUrl:string|null;publishedAt:string|null;category?:{name:string}|null};
export default async function NoticiasPage({searchParams}:{searchParams:Promise<{q?:string;category?:string;page?:string}>}){const q=await searchParams;const url=new URL(`${api}/content/news`);for(const [k,v] of Object.entries(q))if(v)url.searchParams.set(k,v);let result:{items:NewsItem[];page:number;pages:number}={items:[],page:1,pages:0};try{const r=await fetch(url,{next:{revalidate:60}});if(r.ok)result=await r.json();}catch{}return <main id="conteudo" className="page-wrap"><div className="page-heading"><div className="section-kicker">GIO CPF</div><h1>Notícias</h1><p>Acompanhe as actividades e conquistas da instituição.</p></div><form className="course-toolbar" action="/noticias"><label className="field">Pesquisar por título<input name="q" defaultValue={q.q}/></label><button className="button button-primary">Pesquisar</button></form><div className="public-content-grid">{result.items.map(n=><article className="public-news-card" key={n.slug}>{n.coverUrl&&<Image src={n.coverUrl} alt="" width={640} height={380}/>}<div>{n.category&&<span className="course-area">{n.category.name}</span>}<h2><Link href={`/noticias/${n.slug}`}>{n.title}</Link></h2><p>{n.summary}</p><small>{n.publishedAt?new Date(n.publishedAt).toLocaleDateString('pt-MZ'):''}</small></div></article>)}{!result.items.length&&<p className="empty-state">Ainda não há notícias publicadas.</p>}</div><nav className="admin-nav"><Link aria-disabled={result.page<=1} href={`/noticias?page=${Math.max(1,result.page-1)}`}>Anterior</Link><span>Página {result.page} de {result.pages}</span><Link aria-disabled={result.page>=result.pages} href={`/noticias?page=${Math.min(result.pages,result.page+1)}`}>Seguinte</Link></nav></main>}



