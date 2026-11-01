import { API_BASE } from '@/lib/api-url';
import Image from 'next/image';import type {Metadata} from 'next';
const api=API_BASE;type Album={title:string;description:string;photos:{url:string;alt:string}[]};async function getAlbum(slug:string):Promise<Album|null>{try{const r=await fetch(`${api}/content/albums/${encodeURIComponent(slug)}`,{next:{revalidate:60}});return r.ok?r.json():null}catch{return null}}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const a=await getAlbum(slug);return {title:a?.title??'Álbum',description:a?.description};}
export default async function AlbumDetail({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const a=await getAlbum(slug);if(!a)return <main id="conteudo" className="page-wrap"><h1>Álbum não encontrado</h1></main>;return <main id="conteudo" className="page-wrap"><div className="page-heading"><div className="section-kicker">GALERIA</div><h1>{a.title}</h1><p>{a.description}</p></div><div className="public-content-grid">{a.photos.map((p,i)=><Image key={p.url+i} src={p.url} alt={p.alt} width={640} height={440}/>)}</div></main>}


