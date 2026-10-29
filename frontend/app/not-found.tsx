import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="conteudo" className="page-wrap">
      <div className="page-heading">
        <div className="section-kicker">PÁGINA NÃO ENCONTRADA</div>
        <h1>Não encontrámos essa página.</h1>
        <p>O endereço pode ter mudado. Explore os cursos ou volte ao início.</p>
        <Link className="button button-primary" href="/cursos">
          Ver cursos
        </Link>
      </div>
    </main>
  );
}
