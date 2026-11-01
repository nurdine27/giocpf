import Image from 'next/image';
import Link from 'next/link';
import { areas, faqs } from '@/lib/content';
import { Icon } from '@/components/icon';
import { PublicUpdates } from '@/components/public-updates';
export default function Home() {
  return (
    <main id="conteudo">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" /> INSCRIÇÕES ABERTAS
          </div>
          <h1>
            Aprenda hoje.
            <br />
            <span>Avance com confiança.</span>
          </h1>
          <p className="hero-lede">Cursos práticos e profissionalizantes de curta duração.</p>
          <p className="hero-detail">
            Desenvolva competências técnicas e profissionais, com enfoque na inclusão social através
            do acesso à educação.
          </p>
          <div className="hero-actions">
            <Link href="/inscricao" className="button button-primary">
              Inscrever-me <Icon name="arrow_forward" />
            </Link>
            <Link href="/cursos" className="button button-light">
              Conhecer os cursos
            </Link>
          </div>
          <div className="hero-meta">
            <span>
              <Icon name="workspace_premium" /> Certificado de conclusão
            </span>
            <span>
              <Icon name="handyman" /> Aprendizagem prática
            </span>
          </div>
        </div>
        <div className="hero-media">
          <Image
            src="/images/training-safety.jpeg"
            alt="Formandos em aula prática com equipamento de protecção"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 50vw"
            className="hero-image"
          />
          <div className="hero-caption">
            <Icon name="school" />
            <span>
              Formação técnica
              <br />
              <small>Conhecimento para o mundo real</small>
            </span>
          </div>
          <div className="hero-image-note">GIO · Moçambique</div>
        </div>
      </section>
      <section className="section intro-section" id="sobre">
        <div className="section-kicker">O GIO</div>
        <div className="intro-grid">
          <h2>
            Aprender competências.
            <br />
            <span>Abrir caminhos.</span>
          </h2>
          <div>
            <p>
              Oferecemos cursos cuidadosamente estruturados nas áreas de comunicação, tecnologia,
              arte e outras competências essenciais, combinando teoria com prática real.
            </p>
            <p>
              Cada formação é projectada para desenvolver habilidades concretas, preparando os
              nossos alunos para enfrentar desafios do mercado de trabalho com confiança.
            </p>
            <Link className="text-link" href="/sobre">
              Missão, visão e valores <Icon name="arrow_forward" />
            </Link>
          </div>
        </div>
        <div className="value-grid">
          <article>
            <Icon name="track_changes" />
            <h3>Porquê escolher-nos</h3>
            <p>
              Preparamos o formando para o mundo real. Aprenda com especialistas, pratique as
              habilidades que o mercado exige e avance com confiança.
            </p>
          </article>
          <article>
            <Icon name="schedule" />
            <h3>Curta duração, efeito longo</h3>
            <p>
              Formações concentradas no essencial, pensadas para quem trabalha ou quer entrar
              rapidamente no mercado.
            </p>
          </article>
          <article>
            <Icon name="diversity_3" />
            <h3>Acesso à educação</h3>
            <p>Capacitação técnica e desenvolvimento humano com enfoque na inclusão social.</p>
          </article>
        </div>
      </section>
      <section className="section areas-section" id="areas">
        <div className="section-heading">
          <div>
            <div className="section-kicker">ÁREAS DE FORMAÇÃO</div>
            <h2>
              Cinco áreas.
              <br />
              Um caminho para o mercado.
            </h2>
          </div>
          <p>Explore uma área e encontre a formação que procura.</p>
        </div>
        <div className="area-grid">
          {areas.map((a, i) => (
            <Link
              key={a.name}
              href={`/cursos?area=${encodeURIComponent(a.name)}`}
              className="area-card"
            >
              <div className="area-top">
                <span className="area-index">0{i + 1}</span>
                <Icon name={a.icon} />
              </div>
              <h3>{a.name}</h3>
              <p>
                {a.courses.slice(0, 3).join(' · ')}
                {a.courses.length > 3 ? ' · …' : ''}
              </p>
              <span className="area-link">
                Ver cursos <Icon name="arrow_forward" />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="section learning-section">
        <div className="section-heading">
          <div>
            <div className="section-kicker">DENTRO DA SALA</div>
            <h2>Aprender com as mãos.</h2>
          </div>
          <p>Turmas em formação nas áreas técnica, industrial e de informática.</p>
        </div>
        <div className="gallery-grid">
          <figure className="gallery-large">
            <Image
              src="/images/training-welding.jpeg"
              alt="Formando a soldar uma estrutura metálica"
              fill
              sizes="(max-width: 700px) 100vw, 50vw"
            />
            <figcaption>Serralharia civil</figcaption>
          </figure>
          <figure>
            <Image
              src="/images/training-class.jpeg"
              alt="Turma com capacetes e coletes durante formação de segurança"
              fill
              sizes="(max-width: 700px) 100vw, 25vw"
            />
            <figcaption>Higiene e segurança no trabalho</figcaption>
          </figure>
          <figure>
            <Image
              src="/images/training-computers.jpeg"
              alt="Sala de informática com formandos ao computador"
              fill
              sizes="(max-width: 700px) 100vw, 25vw"
            />
            <figcaption>Informática e tecnologia</figcaption>
          </figure>
        </div>
      </section>
      <PublicUpdates />
      <section className="faq-section section" id="faq">
        <div className="faq-heading">
          <div className="section-kicker">PERGUNTAS FREQUENTES</div>
          <h2>Dúvidas mais comuns.</h2>
          <p>
            Não encontrou a sua pergunta? <Link href="/contactos">Fale connosco.</Link>
          </p>
        </div>
        <div className="faq-list">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <Icon name="add" />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="cta-band">
        <div>
          <div className="section-kicker">O PRÓXIMO PASSO COMEÇA AQUI</div>
          <h2>Pronto para avançar?</h2>
          <p>
            Escolha uma formação e inscreva-se. A nossa equipa confirma a turma e os próximos
            passos.
          </p>
        </div>
        <Link className="button button-primary" href="/inscricao">
          Fazer inscrição <Icon name="arrow_forward" />
        </Link>
      </section>
    </main>
  );
}
