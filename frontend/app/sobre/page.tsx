import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Sobre o GIO' };
export default function Sobre() {
  return (
    <main id="conteudo" className="page-wrap">
      <div className="page-heading">
        <div className="section-kicker">QUEM SOMOS</div>
        <h1>GIO Centro de Formação</h1>
        <p>
          Instituição orientada para o desenvolvimento de competências técnicas e profissionais, com
          enfoque na inclusão social através do acesso universal à educação.
        </p>
      </div>
      <div className="identity-grid">
        <article>
          <span>MISSÃO</span>
          <p>
            Promover a capacitação técnica, o desenvolvimento humano e a transformação social, por
            meio de práticas educativas inovadoras.
          </p>
        </article>
        <article>
          <span>VISÃO</span>
          <p>
            Estimular competências técnicas e socio-emocionais, promovendo a inclusão, a ética
            profissional e a responsabilidade social, e fortalecendo o desenvolvimento sustentável
            da comunidade local.
          </p>
        </article>
        <article>
          <span>VALORES</span>
          <p>Excelência · Inovação · Ética e integridade · Inclusão · Diversidade</p>
        </article>
      </div>
    </main>
  );
}
