import type { Metadata } from 'next';
import { PageIntro } from '@/components/public-ui';
import { CookiePreferencesLink } from '@/components/cookie-consent';
import { getSiteInfo } from '@/lib/site';

export const metadata: Metadata = { title: 'Política de Privacidade' };

export default async function Privacy() {
  const site = await getSiteInfo();
  return (
    <main id="conteudo" className="page-wrap">
      <PageIntro
        title="Política de Privacidade"
        lede="Como o GIO Centro de Formação recolhe, utiliza e protege os seus dados pessoais."
        crumbs={[{ href: '/politica-de-privacidade', label: 'Privacidade' }]}
      />
      <article className="form-card legal">
        <h2>Dados recolhidos na inscrição</h2>
        <p>
          Nome completo, data de nascimento, género, documento de identificação (opcional), nível de
          escolaridade, ocupação, telefone, e-mail (opcional), província, distrito e endereço,
          contacto de emergência (opcional), curso, pólo e turma pretendidos, como soube do GIO e
          uma mensagem opcional.
        </p>
        <h2>Para que usamos os dados</h2>
        <ul>
          <li>Gerir a inscrição, a colocação numa turma e a lista de espera;</li>
          <li>Contactar o candidato sobre a vaga, documentos e início das aulas;</li>
          <li>Emitir listas de turma e certificados;</li>
          <li>Produzir estatísticas internas agregadas (sem identificar pessoas).</li>
        </ul>
        <h2>Conservação e partilha</h2>
        <p>
          Os dados são conservados apenas enquanto forem necessários para estes fins e para
          obrigações legais. Só a equipa autorizada tem acesso, com permissões definidas por função.
          Não vendemos nem partilhamos dados com terceiros para fins comerciais. Os e-mails são
          enviados através de um fornecedor de envio (Resend) e as imagens do site são alojadas no
          Cloudinary.
        </p>
        <h2 id="cookies">Cookies</h2>
        <p>Utilizamos três categorias de cookies:</p>
        <ul>
          <li>
            <strong>Necessários</strong> — sessão da área administrativa, segurança e a memória da
            sua escolha de cookies (6 meses). Estão sempre activos.
          </li>
          <li>
            <strong>Estatísticas</strong> — medição anónima de visitas para melhorar o site. Só com
            a sua autorização.
          </li>
          <li>
            <strong>Marketing</strong> — medição de campanhas nas redes sociais. Só com a sua
            autorização.
          </li>
        </ul>
        <p>
          Pode alterar a sua escolha a qualquer momento: <CookiePreferencesLink />
        </p>
        <h2>Os seus direitos</h2>
        <p>
          Pode pedir acesso, correcção ou eliminação dos seus dados, ou retirar o consentimento,
          escrevendo para <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      </article>
    </main>
  );
}
