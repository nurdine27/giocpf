'use client';
import { API_BASE } from '@/lib/api-url';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminListCard, FlashMessage } from './admin-ui';
const api = API_BASE;
const choices = [['dashboard.read','Painel'],['registrations.read','Consultar inscrições'],['registrations.manage','Gerir inscrições'],['courses.manage','Cursos'],['news.manage','Notícias'],['events.manage','Eventos'],['gallery.manage','Galeria'],['messages.read','Ler mensagens'],['messages.manage','Gerir estado das mensagens'],['messages.reply','Responder mensagens'],['settings.manage','Configurações institucionais'],['users.manage','Administradores']] as const;
type Admin = {id:string;email:string;permissions:string[];isSuperAdmin:boolean;createdAt:string};
export function AdminUsers() {
  const router=useRouter(); const [rows,setRows]=useState<Admin[]>([]); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function load(){const r=await fetch(`${api}/admin/admin-users?page=1&limit=50`,{credentials:'include'});if(r.status===401){router.replace('/admin/login');return;}if(r.status===403){setError('Esta área é exclusiva do administrador principal.');return;}if(!r.ok)throw new Error();const result=await r.json();setRows(result.data);}
  useEffect(()=>{load().catch(()=>setError('Não foi possível carregar os administradores. Tente novamente.'));},[]);
  async function create(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const f=e.currentTarget;const form=new FormData(f);const payload={email:form.get('email'),password:form.get('password'),permissions:form.getAll('permissions')};try{const r=await fetch(`${api}/admin/admin-users`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error();f.reset();setError('Administrador criado com sucesso.');await load();}catch{setError('Não foi possível criar o administrador. Confirme os dados e tente novamente.');}finally{setBusy(false);}}
  return <main id="conteudo" className="admin-shell"><div className="page-heading"><div className="section-kicker">SEGURANÇA</div><h1>Administradores e permissões</h1><p>Crie contas de equipa e limite o que cada pessoa pode gerir.</p></div><nav className="admin-nav"><Link href="/admin">Painel</Link><Link href="/admin/conteudos">Conteúdos</Link></nav>{error&&<FlashMessage type={error.includes('sucesso')?'success':'error'}>{error}</FlashMessage>}<form className="form-card" onSubmit={create}><h2>Novo administrador</h2><div className="form-grid"><label className="field">E-mail<input type="email" name="email" required/></label><label className="field">Palavra-passe temporária<input type="password" name="password" minLength={12} required autoComplete="new-password"/></label><fieldset className="field full permission-options"><legend>Permissões</legend>{choices.map(([value,label])=><label className="check-field" key={value}><input type="checkbox" name="permissions" value={value}/>{label}</label>)}</fieldset><button className="button button-primary" disabled={busy}>{busy?'A criar…':'Criar administrador'}</button></div></form><h2 className="admin-list-heading">Contas existentes</h2><div className="admin-list-stack">{rows.map(a=><AdminListCard key={a.id} title={a.email} meta={a.isSuperAdmin?'Administrador principal':`Permissões: ${a.permissions.map(p=>choices.find(c=>c[0]===p)?.[1]??p).join(', ')||'Nenhuma'}` } actions={[]}/> )}</div></main>;
}




