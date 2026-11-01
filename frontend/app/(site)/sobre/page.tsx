import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { PageIntro } from '@/components/public-ui';
import { IDENTITY } from '@/lib/site';
import { areas } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Sobre nós',
  description: 'Missão, visão e valores do GIO Centro de Formação.',
};

export default function Sobre() {
  const courseCount = areas.reduce((sum, a) => sum + a.courses.length, 0);
  return (
    <main id="conteudo" className="page-wrap">
      <PageIntro
        title="Formação que abre caminhos"
        lede="O GIO Centro de Formação desenvolve competências técnicas e profissionais, com enfoque na inclusão social através do acesso à educação."
        crumbs={[{ href: '/sobre', label: 'Sobre nós' }]}
      />
      <section className="about-split">
        <div className="about-media">
          <Image
            src="/images/training-class.jpeg"
            alt="Turma do GIO durante uma formação prática"
            fill
            sizes="(max-width: 800px) 100vw, 50vw"
          />
        </div>
        <div>
          <p>
            Oferecemos cursos estruturados nas áreas de gestão, comunicação, tecnologia, indústria e
            gastronomia, combinando teoria com prática real.
          </p>
          <p>
            Cada formação é projectada para desenvolver habilidades concretas, preparando os nossos
            formandos para enfrentar o mercado de trabalho com confiança.
          </p>
          <dl className="about-figures">
            <div>
              <dt>Áreas de formação</dt>
              <dd>{areas.length}</dd>
            </div>
            <div>
              <dt>Cursos disponíveis</dt>
              <dd>{courseCount}</dd>
            </div>
            <div>
              <dt>Certificado</dt>
              <dd>
                <Icon name="workspace_premium" />
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="identity-cards" aria-label="Identidade institucional">
        {IDENTITY.map((item) => (
          <article key={item.title}>
            <span className="identity-icon">
              <Icon name={item.icon} />
            </span>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
          </article>
        ))}
      </section>
      <section className="cta-inline">
        <div>
          <h2>Pronto para começar?</h2>
          <p>Escolha uma formação e inscreva-se em poucos minutos.</p>
        </div>
        <Link className="button button-primary" href="/cursos">
          Ver cursos <Icon name="arrow_forward" />
        </Link>
      </section>
    </main>
  );
}
