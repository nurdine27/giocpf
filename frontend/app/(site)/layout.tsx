import { Footer, Header } from '@/components/site-shell';
import { getSiteInfo } from '@/lib/site';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteInfo();
  return (
    <>
      <Header site={site} />
      {children}
      <Footer site={site} />
    </>
  );
}
