import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegistrationForm } from '@/components/registration-form';
export const metadata: Metadata = {
  title: 'Inscrição',
  description: 'Inscreva-se num curso do GIO Centro de Formação.',
};
export default function Inscricao() {
  return (
    <main id="conteudo" className="page-wrap">
      <div className="page-heading">
        <div className="section-kicker">FAÇA A SUA INSCRIÇÃO</div>
        <h1>O seu próximo passo começa aqui.</h1>
        <p>
          Preencha o formulário. A equipa do GIO entrará em contacto para confirmar a turma, o
          horário e os documentos necessários.
        </p>
      </div>
      <Suspense fallback={<p>A preparar o formulário…</p>}>
        <RegistrationForm />
      </Suspense>
    </main>
  );
}
