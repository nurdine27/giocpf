import { API_BASE } from '@/lib/api-url';
import Image from 'next/image';import type {Metadata} from 'next';
const api=API_BASE;type Ev={title:string;description:string;location:string;coverUrl:string|null;startsAt:string;endsAt:string|null;status:string;photos:{url:string;alt:string}[]};
async function getEvent(slug:string):Promise<Ev|null>{try{const r=await fetch(`${api}/content/events/${encodeURIComponent(slug)}`,{next:{revalidate:60}});return r.ok?r.json():null}catch{return null}}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const e=await getEvent(slug);return e?{title:e.title,description:e.description,openGraph:{title:e.title,description:e.description,images:e.coverUrl?[e.coverUrl]:[]}}:{title:'Evento não encontrado'};}
export default async function EventoDetail({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const e=await getEvent(slug);if(!e)return <main id="conteudo" className="page-wrap"><h1>Evento não encontrado</h1></main>;return <main id="conteudo" className="page-wrap article-page"><div className="section-kicker">{e.status}</div><h1>{e.title}</h1><p>{new Date(e.startsAt).toLocaleString('pt-MZ')} · {e.location}</p>{e.coverUrl&&<Image className="article-cover" src={e.coverUrl} alt="" width={1200} height={700}/>}<article className="article-body">{e.description}</article><div className="public-content-grid">{e.photos?.map(p=><Image key={p.url} src={p.url} alt={p.alt} width={640} height={440}/>)}</div></main>}


