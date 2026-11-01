'use client';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="conteudo" className="page-wrap"><section className="form-card" role="alert"><div className="section-kicker">ERRO TEMPORÁRIO</div><h1>Não foi possível carregar esta página.</h1><p>O conteúdo continua seguro. Tente novamente dentro de instantes.</p><button className="button button-primary" onClick={reset}>Tentar novamente</button></section></main>;
}


