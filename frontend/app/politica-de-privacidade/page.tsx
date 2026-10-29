import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Política de Privacidade' };
export default function Privacy() {
  return (
    <main id="conteudo" className="page-wrap">
      <div className="page-heading">
        <div className="section-kicker">PRIVACIDADE</div>
        <h1>Política de Privacidade</h1>
        <p>
          O GIO Centro de Formação utiliza os dados submetidos no formulário de inscrição para gerir
          o pedido e contactar a pessoa inscrita sobre o curso escolhido.
        </p>
      </div>
      <article className="form-card">
        <h2>Dados recolhidos</h2>
        <p>
          O formulário pode solicitar nome, telefone, e-mail opcional, idade opcional, província,
          distrito, área, curso e uma mensagem opcional.
        </p>
        <h2>Utilização e conservação</h2>
        <p>
          Os dados são utilizados para dar seguimento à inscrição e são conservados apenas enquanto
          forem necessários para esse fim e para obrigações aplicáveis. Não publique dados pessoais
          de candidatos.
        </p>
        <h2>Contacto</h2>
        <p>
          Para questões sobre os dados submetidos, escreva para{' '}
          <a href="mailto:giocentrodeformacao@gmail.com">giocentrodeformacao@gmail.com</a>.
        </p>
      </article>
    </main>
  );
}
