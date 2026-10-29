import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header, Footer } from '@/components/site-shell';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://giocentrodeformacao.co.mz'),
  title: {
    default: 'GIO Centro de Formação | Cursos práticos em Moçambique',
    template: '%s | GIO Centro de Formação',
  },
  description: 'Cursos práticos e profissionalizantes de curta duração no GIO Centro de Formação.',
  openGraph: {
    title: 'GIO Centro de Formação',
    description: 'Cursos práticos e profissionalizantes em Moçambique.',
    locale: 'pt_MZ',
    type: 'website',
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#12352e' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-MZ">
      <body>
        <a className="skip-link" href="#conteudo">
          Saltar para o conteúdo
        </a>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
