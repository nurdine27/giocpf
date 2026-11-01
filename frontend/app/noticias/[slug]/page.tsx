import { API_BASE } from '@/lib/api-url';
import Image from 'next/image';
import type {Metadata} from 'next';
const api=API_BASE;
type Article={title:string;subtitle:string;content:string;coverUrl:string|null;publishedAt:string|null;category?:{name:string}|null;photos:{url:string;alt:string}[]};
async function getArticle(slug:string):Promise<Article|null>{try{const r=await fetch(`${api}/content/news/${encodeURIComponent(slug)}`,{next:{revalidate:60}});return r.ok?r.json():null;}catch{return null;}}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const n=await getArticle(slug);return n?{title:n.title,description:n.subtitle||n.content.slice(0,155),openGraph:{title:n.title,description:n.subtitle||n.content.slice(0,155),images:n.coverUrl?[n.coverUrl]:[]}}:{title:'Notícia não encontrada'};}
export default async function NewsDetail({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const n=await getArticle(slug);if(!n)return <main id="conteudo" className="page-wrap"><h1>Notícia não encontrada</h1></main>;return <main id="conteudo" className="page-wrap article-page"><div className="section-kicker">{n.category?.name||'NOTÍCIA'}</div><h1>{n.title}</h1>{n.subtitle&&<p className="article-lede">{n.subtitle}</p>}<time>{n.publishedAt?new Date(n.publishedAt).toLocaleDateString('pt-MZ'):''}</time>{n.coverUrl&&<Image className="article-cover" src={n.coverUrl} alt="" width={1200} height={700} priority/>}<article className="article-body">{n.content.split(/\n{2,}/).map((p,i)=><p key={i}>{p}</p>)}</article>{n.photos?.length>0&&<div className="public-content-grid">{n.photos.map((p,i)=><Image key={p.url+i} src={p.url} alt={p.alt} width={640} height={440}/>)}</div>}</main>}


