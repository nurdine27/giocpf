'use client';
import { useState } from 'react';

export function FlashMessage({ type = 'success', children, onClose }: { type?: 'success' | 'error' | 'info'; children: React.ReactNode; onClose?: () => void }) {
  if (!children) return null;
  return <div className={`flash-message flash-${type}`} role={type === 'error' ? 'alert' : 'status'}><span className="material-symbols">{type==='error'?'error':type==='info'?'info':'check_circle'}</span><span>{children}</span>{onClose && <button type="button" aria-label="Fechar mensagem" onClick={onClose}><span className="material-symbols">close</span></button>}</div>;
}

export function AdminListCard({ title, meta, children, actions }: { title: string; meta?: React.ReactNode; children?: React.ReactNode; actions: { label: string; onSelect: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  return <article className="admin-list-card"><div className="admin-list-card-copy"><strong>{title}</strong>{meta && <span>{meta}</span>}{children}</div>{actions.length>0&&<div className="admin-card-actions"><button type="button" className="admin-kebab" aria-label={`Acções de ${title}`} aria-expanded={open} onClick={() => setOpen(!open)}><span className="material-symbols">more_vert</span></button>{open && <div className="admin-action-menu" role="menu">{actions.map((a) => <button type="button" role="menuitem" className={a.danger?'danger-action':''} key={a.label} onClick={() => {setOpen(false);a.onSelect();}}>{a.label}</button>)}</div>}</div>}</article>;
}


