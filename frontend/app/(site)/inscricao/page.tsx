import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegistrationForm } from '@/components/registration-form';
import { PageIntro } from '@/components/public-ui';
export const metadata: Metadata = {
  title: 'Inscrição',
  description: 'Inscreva-se num curso do GIO Centro de Formação.',
};
export default function Inscricao() {
  return (
    <main id="conteudo" className="page-wrap">
      <PageIntro
        title="Inscrição"
        lede="Preencha o formulário. A equipa do GIO entrará em contacto para confirmar a turma, o horário e os documentos necessários."
        crumbs={[{ href: '/inscricao', label: 'Inscrição' }]}
      />
      <Suspense fallback={<p>A preparar o formulário…</p>}>
        <RegistrationForm />
      </Suspense>
    </main>
  );
}
