'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/icon';
function Confirmation() {
  const params = useSearchParams();
  const reference = params.get('referencia');
  return (
    <main id="conteudo" className="page-wrap">
      <div className="success-card">
        <span className="success-icon">
          <Icon name="task_alt" />
        </span>
        <h1>Inscrição enviada</h1>
        <p>
          A gravação foi concluída. A equipa do GIO entrará em contacto para confirmar a turma e os
          próximos passos.
        </p>
        {reference && (
          <p>
            Guarde a sua referência: <strong>{reference}</strong>.
          </p>
        )}
        <Link className="button button-primary" href="/">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
export default function Success() {
  return (
    <Suspense fallback={<main className="page-wrap">A confirmar inscrição…</main>}>
      <Confirmation />
    </Suspense>
  );
}
