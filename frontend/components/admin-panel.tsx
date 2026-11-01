'use client';
import { API_BASE } from '@/lib/api-url';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminListCard, FlashMessage } from './admin-ui';
const api = API_BASE;
type CourseRow = {
  id: string;
  name: string;
  area: string;
  published: boolean;
  enrollmentOpen: boolean;
};
type TrendData={publications:{month:string;total:number}[];messages:{month:string;total:number}[];categories:{name:string;total:number}[]};
export function AdminPanel() {
  const router = useRouter();
  const [data, setData] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');
  const [trends,setTrends]=useState<TrendData|null>(null);
  useEffect(() => {
    fetch(`${api}/admin/dashboard`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/admin/login');
          return;
        }
        if (!r.ok) throw new Error('Não foi possível carregar o painel.');
        setData(await r.json());
      })
      .catch(() => setError('Não foi possível carregar os dados. Verifique a ligação e tente novamente.'));
  }, [router]);
  useEffect(()=>{fetch(`${api}/admin/dashboard/trends`,{credentials:'include'}).then(r=>r.ok?r.json():null).then((v)=>{if(v)setTrends(v)}).catch(()=>setError('Algumas métricas não puderam ser carregadas.'));},[]);
  async function logout() {
    await fetch(`${api}/auth/logout`, { method: 'POST', credentials: 'include' });
    router.replace('/admin/login');
  }
  return (
    <main id="conteudo" className="admin-shell">
      <div className="page-heading">
        <div className="section-kicker">ADMINISTRAÇÃO</div>
        <h1>Painel de gestão</h1>
        <p>Resumo actualizado das inscrições e cursos.</p>
      </div>
      <nav className="admin-nav">
        <Link href="/admin/inscricoes">Inscrições</Link>
        <Link href="/admin/cursos">Cursos</Link>
        <Link href="/admin/conteudos">Conteúdos</Link>
        <Link href="/admin/administradores">Administradores</Link>
        <Link href="/admin/mensagens">Mensagens</Link>
        <button className="button button-light" onClick={logout}>
          Terminar sessão
        </button>
      </nav>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {!data ? (
        <p>A carregar…</p>
      ) : (
        <div className="admin-stats">
          {[
            ['Inscrições', data.total],
            ['Pendentes', data.pending],
            ['Em análise', data.review],
            ['Aceites', data.accepted],
            ['Recusadas', data.rejected],
            ['Cursos', data.courses],
            ['Notícias', data.newsTotal],
            ['Publicadas', data.newsPublished],
            ['Rascunhos', data.newsDrafts],
            ['Eventos', data.eventsTotal],
            ['Próximos eventos', data.eventsUpcoming],
            ['Eventos realizados', data.eventsPast],
            ['Álbuns', data.albumsTotal],
            ['Fotografias', data.photosTotal],
            ['Mensagens', data.messagesTotal],
            ['Não lidas', data.messagesUnread],
          ].map(([k, v]) => (
            <div className="admin-stat" key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      )}
      {trends&&<section className="dashboard-charts"><article className="form-card"><h2>Publicações por mês</h2><div className="mini-chart">{trends.publications.map(x=><div key={x.month}><span style={{height:`${Math.max(5,x.total/Math.max(1,...trends.publications.map(y=>y.total))*100)}%`}}/><small>{x.month.slice(5)}</small></div>)}</div></article><article className="form-card"><h2>Mensagens recebidas</h2><div className="mini-chart chart-lime">{trends.messages.map(x=><div key={x.month}><span style={{height:`${Math.max(5,x.total/Math.max(1,...trends.messages.map(y=>y.total))*100)}%`}}/><small>{x.month.slice(5)}</small></div>)}</div></article><article className="form-card"><h2>Notícias por categoria</h2>{trends.categories.length?trends.categories.map(x=><p key={x.name} className="chart-category"><span>{x.name}</span><strong>{x.total}</strong></p>):<p className="empty-state">Ainda sem categorias publicadas.</p>}</article></section>}
    </main>
  );
}

export function ContentAdmin() {
  const router = useRouter();
  const [data, setData] = useState<{ news: Record<string, unknown>[]; events: Record<string, unknown>[]; albums: Record<string, unknown>[]; categories: Record<string, string>[] }>({ news: [], events: [], albums: [], categories: [] });
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [tab, setTab] = useState('news');
  const apiUrl = api;
  async function load() { const r = await fetch(`${apiUrl}/admin/content`, { credentials: 'include' }); if (r.status === 401) return router.replace('/admin/login'); if (!r.ok) throw new Error('Falha ao carregar conteúdos.'); setData(await r.json()); }
  useEffect(() => { load().catch(() => setError('Não foi possível carregar os conteúdos. Tente novamente.')); }, []);
  async function create(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const raw = Object.fromEntries(new FormData(form)); const d: Record<string, unknown> = { ...raw }; for (const key of ['published','featured']) d[key] = (form.elements.namedItem(key) as HTMLInputElement | null)?.checked ?? false; const cover = form.elements.namedItem('coverFile') as HTMLInputElement | null; const gallery = form.elements.namedItem('galleryFiles') as HTMLInputElement | null; const files = [...(cover?.files ? Array.from(cover.files) : []), ...(gallery?.files ? Array.from(gallery.files) : [])]; if (files.length) { const fd = new FormData(); files.forEach((f) => fd.append('images', f)); const up = await fetch(`${apiUrl}/admin/content/upload`, { method:'POST', credentials:'include', body:fd }); if(!up.ok){setError('Upload falhou. Verifique Cloudinary, formato e limite de 10 MB por fotografia.');return;} const uploaded: {url:string;publicId:string;name?:string}[] = await up.json(); let i=0; if(cover?.files?.length){d.coverUrl=uploaded[i].url;d.coverPublicId=uploaded[i].publicId;i++;} if(gallery?.files?.length){const assets=uploaded.slice(i);d.photos=assets.map(x=>x.url).join('\n');d.photoAssets=JSON.stringify(assets.map(x=>({url:x.url,publicId:x.publicId,alt:x.name||''})));} } const r = await fetch(`${apiUrl}/admin/content/${tab}`, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify(d) }); if(!r.ok){setError('Não foi possível guardar. Verifique os campos e URLs.');return;} form.reset(); setError(''); setFlash('Conteúdo criado com sucesso.'); await load(); }
  async function change(kind: string, id: string, body: object) { const publish = 'published' in body; if(publish&&!window.confirm((body as {published:boolean}).published?'Publicar este conteúdo no site?':'Despublicar este conteúdo?'))return; const r = await fetch(`${apiUrl}/admin/content/${kind}/${id}`, {method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); if(!r.ok) setError('Não foi possível actualizar.'); else {setError('');setFlash('Estado actualizado com sucesso.');} await load(); }
  async function remove(kind:string,id:string){ if(!window.confirm('Eliminar este conteúdo permanentemente? Esta acção não pode ser anulada.')) return; const r=await fetch(`${apiUrl}/admin/content/${kind}/${id}`,{method:'DELETE',credentials:'include'}); if(!r.ok)setError('Não foi possível eliminar.'); else {setError('');setFlash('Conteúdo eliminado.');} await load(); }
  const rows = data[tab as 'news'|'events'|'albums'];
  return <main id="conteudo" className="admin-shell"><div className="page-heading"><div className="section-kicker">GESTÃO</div><h1>Conteúdos</h1><p>Notícias, eventos e álbuns da instituição.</p></div><nav className="admin-nav"><Link href="/admin">Resumo</Link><Link href="/admin/cursos">Cursos</Link>{[['news','Notícias'],['events','Eventos'],['albums','Galeria']].map(([k,v])=><button key={k} className="button button-light" onClick={()=>setTab(k)}>{v}</button>)}</nav>{flash&&<FlashMessage onClose={()=>setFlash("")}>{flash}</FlashMessage>}{error&&<FlashMessage type="error">{error}</FlashMessage>}<form className="form-card" onSubmit={create}><h2>{tab==='news'?'Nova notícia':tab==='events'?'Novo evento':'Novo álbum'}</h2><div className="form-grid"><label className="field">Título<input name="title" required minLength={3}/></label>{tab==='news'&&<><label className="field">Subtítulo<input name="subtitle"/></label><label className="field">Resumo<input name="summary"/></label><label className="field">Categoria<select name="category"><option value="">Sem categoria</option>{data.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field full">Conteúdo<textarea name="content" required/></label></>}{tab==='events'&&<><label className="field">Local<input name="location"/></label><label className="field">Início<input type="datetime-local" name="startsAt" required/></label><label className="field">Fim<input type="datetime-local" name="endsAt"/></label><label className="field">Estado<select name="status"><option value="AGENDADO">Agendado</option><option value="EM_CURSO">Em curso</option><option value="REALIZADO">Realizado</option><option value="CANCELADO">Cancelado</option></select></label></>}<label className="field">Imagem de capa<input type="file" name="coverFile" accept="image/jpeg,image/png,image/webp,image/gif"/><input type="url" name="coverUrl" placeholder="URL opcional https://…"/></label><label className="field full">Fotografias adicionais<input type="file" name="galleryFiles" accept="image/jpeg,image/png,image/webp,image/gif" multiple/></label>{tab==='albums'&&<><label className="field full">URLs de fotografias (uma por linha)<textarea name="photos"/></label><label className="field">Associar notícia (ID)<input name="newsId"/></label><label className="field">Associar evento (ID)<input name="eventId"/></label></>}{tab==='events'&&<label className="field full">Descrição<textarea name="description"/></label>}<label className="check-field"><input type="checkbox" name="published"/> Publicar</label><label className="check-field"><input type="checkbox" name="featured"/> Destacar na página inicial</label><button className="button button-primary">Guardar</button></div></form><div className="admin-list-stack">{rows.map((item)=>{const id=String(item.id), title=String(item.title), pub=Boolean(item.published), author=(item.author as {email?:string}|undefined)?.email;return <AdminListCard key={id} title={title} meta={`${pub?"Publicado":"Rascunho"}${author?` · Criado por ${author}`:""}`} actions={[{label:pub?"Despublicar":"Publicar",onSelect:()=>change(tab,id,{published:!pub})},{label:"Eliminar",danger:true,onSelect:()=>remove(tab,id)}]}/>})}{rows.length===0&&<p className="empty-state">Ainda não há conteúdos nesta secção.</p>}</div></main>
}
export function RegistrationAdmin() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');
  const router = useRouter();
  useEffect(() => {
    const u = new URL(`${api}/registrations`);
    u.searchParams.set('page', String(page));
    if (q) u.searchParams.set('q', q);
    if (status) u.searchParams.set('status', status);
    fetch(u, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/admin/login');
          return;
        }
        const x = await r.json();
        setRows(x.items ?? []);
      })
      .catch(() => setErr('Não foi possível carregar as inscrições. Verifique a ligação e tente novamente.'));
  }, [q, status, page, router]);
  async function change(id: string, next: string) {
    if (next === 'RECUSADA' && !window.confirm('Confirmar a recusa desta inscrição?')) return;
    const r = await fetch(`${api}/admin/registrations/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (r.ok) setRows((old) => old.map((x) => (x.id === id ? { ...x, status: next } : x)));
    else setErr('Não foi possível actualizar o estado.');
  }
  return (
    <main id="conteudo" className="admin-shell">
      <div className="page-heading">
        <div className="section-kicker">GESTÃO</div>
        <h1>Inscrições</h1>
      </div>
      <nav className="admin-nav">
        <Link href="/admin">Resumo</Link>
        <Link href="/admin/cursos">Cursos</Link>
      </nav>
      <div className="course-toolbar">
        <label className="field">
          Pesquisar nome ou referência
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </label>
        <label className="field">
          Estado
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">Todos</option>
            {['PENDENTE', 'EM_ANALISE', 'ACEITE', 'RECUSADA'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {err && (
        <p role="alert" className="form-error">
          {err}
        </p>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Nome</th>
              <th>Curso</th>
              <th>Estado</th>
              <th>Acção</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id}>
                <td>
                  <Link href={`/admin/inscricoes/${x.id}`}>{x.reference}</Link>
                </td>
                <td>{x.name}</td>
                <td>{x.courseName}</td>
                <td>{x.status}</td>
                <td>
                  <select
                    aria-label={`Alterar estado de ${x.reference}`}
                    value={x.status}
                    onChange={(e) => change(x.id, e.target.value)}
                  >
                    {['PENDENTE', 'EM_ANALISE', 'ACEITE', 'RECUSADA'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-cards">
        {rows.map((x) => (
          <article className="mobile-row" key={x.id}>
            <strong>{x.name}</strong>
            <Link href={`/admin/inscricoes/${x.id}`}>
              {x.reference} · {x.courseName}
            </Link>
            <label>
              Estado
              <select value={x.status} onChange={(e) => change(x.id, e.target.value)}>
                {['PENDENTE', 'EM_ANALISE', 'ACEITE', 'RECUSADA'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </div>
      <div className="admin-nav">
        <button
          className="button button-light"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </button>
        <span>Página {page}</span>
        <button
          className="button button-light"
          disabled={rows.length < 20}
          onClick={() => setPage(page + 1)}
        >
          Seguinte
        </button>
      </div>
    </main>
  );
}
export function CourseAdmin() {
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const apiUrl = api;
  async function load() {
    const r = await fetch(`${apiUrl}/admin/courses`, { credentials: 'include' });
    if (r.status === 401) {
      router.replace('/admin/login');
      return;
    }
    if (r.ok) setRows(await r.json());
  }
  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/admin/courses`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/admin/login');
          return;
        }
        if (!r.ok) throw new Error('Não foi possível carregar os cursos.');
        const courses: CourseRow[] = await r.json();
        if (active) setRows(courses);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os cursos. Verifique a ligação e tente novamente.');
      });
    return () => {
      active = false;
    };
  }, [apiUrl, router]);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch(`${apiUrl}/admin/courses`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!r.ok) throw new Error('Não foi possível criar o curso.');
      e.currentTarget.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }
  async function toggle(id: string, key: string, val: boolean) {
    if (key === 'published' && val && !window.confirm('Despublicar este curso?')) return;
    const r = await fetch(`${apiUrl}/admin/courses/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: !val }),
    });
    if (!r.ok) {
      setError('Não foi possível actualizar o curso.');
      return;
    }
    await load();
  }
  return (
    <main id="conteudo" className="admin-shell">
      <div className="page-heading">
        <div className="section-kicker">GESTÃO</div>
        <h1>Cursos</h1>
      </div>
      <nav className="admin-nav">
        <Link href="/admin">Resumo</Link>
        <Link href="/admin/inscricoes">Inscrições</Link>
      </nav>
      <form className="form-card" onSubmit={create}>
        <h2>Novo curso</h2>
        <div className="form-grid">
          <div className="field">
            <label>
              Nome
              <input name="name" required minLength={3} />
            </label>
          </div>
          <div className="field">
            <label>
              Área
              <input name="area" required />
            </label>
          </div>
          <div className="field full">
            <label>
              Descrição
              <textarea name="description" />
            </label>
          </div>
          <div className="field">
            <label>
              Duração (se conhecida)
              <input name="duration" />
            </label>
          </div>
          <div className="field">
            <label>
              Requisitos (se conhecidos)
              <input name="requirements" />
            </label>
          </div>
          <div className="field full">
            <label className="check-field">
              <input name="published" type="checkbox" value="true" /> Publicar curso
            </label>
            <label className="check-field">
              <input name="enrollmentOpen" type="checkbox" value="true" /> Abrir inscrições
            </label>
          </div>
          <button className="button button-primary" disabled={busy}>
            Criar curso
          </button>
        </div>
      </form>
      {error && <p className="form-error">{error}</p>}
      <h2>Cursos existentes</h2>
      <div className="mobile-cards">
        {rows.map((c) => (
          <article className="mobile-row" key={c.id}>
            <strong>
              <Link href={`/admin/cursos/${c.id}`}>{c.name}</Link>
            </strong>
            <span>
              {c.area} · {c.published ? 'Publicado' : 'Rascunho'}
            </span>
            <div className="mobile-row-actions">
              <button
                className="button button-light"
                onClick={() => toggle(c.id, 'published', c.published)}
              >
                {c.published ? 'Despublicar' : 'Publicar'}
              </button>
              <button
                className="button button-light"
                onClick={() => toggle(c.id, 'enrollmentOpen', c.enrollmentOpen)}
              >
                {c.enrollmentOpen ? 'Fechar inscrições' : 'Abrir inscrições'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
