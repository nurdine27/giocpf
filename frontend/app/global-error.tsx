'use client';
import './globals.css';
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="pt-MZ"><body><main className="page-wrap"><section className="form-card" role="alert"><h1>O site encontrou um problema.</h1><p>Tente novamente. Se o erro continuar, contacte a equipa do GIO CPF.</p><button className="button button-primary" onClick={reset}>Tentar novamente</button></section></main></body></html>;
}


