'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
function Confirmation() {
  const params = useSearchParams();
  const reference = params.get('referencia');
  return (
    <main id="conteudo" className="page-wrap">
      <div className="form-success">
        <div className="section-kicker">INSCRIÇÃO ENVIADA</div>
        <h1>Obrigado pelo seu interesse.</h1>
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
