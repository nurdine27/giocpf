import type { Metadata } from 'next';
import { Icon } from '@/components/icon';
import { ContactForm } from '@/components/contact-form';
import { PageIntro } from '@/components/public-ui';
import { getSiteInfo, whatsappLink } from '@/lib/site';

export const metadata: Metadata = { title: 'Contactos' };

export default async function Contactos() {
  const site = await getSiteInfo();
  const channels = [
    { icon: 'chat', label: 'WhatsApp', value: site.phone, href: whatsappLink(site.whatsapp) },
    { icon: 'mail', label: 'E-mail', value: site.email, href: `mailto:${site.email}` },
    {
      icon: 'photo_camera',
      label: 'Instagram',
      value: '@giocentrodeformacao',
      href: site.instagram,
    },
    { icon: 'public', label: 'Facebook', value: site.name, href: site.facebook },
  ];
  return (
    <main id="conteudo" className="page-wrap">
      <PageIntro
        title="Fale connosco"
        lede="Esclareça dúvidas sobre cursos, inscrições ou parcerias. Respondemos o mais breve possível."
        crumbs={[{ href: '/contactos', label: 'Contactos' }]}
      />
      <div className="contact-layout">
        <aside className="contact-channels">
          {channels.map((c) => (
            <a
              key={c.label}
              className="contact-card"
              href={c.href}
              target={c.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
            >
              <span className="contact-icon">
                <Icon name={c.icon} />
              </span>
              <span>
                <strong>{c.label}</strong>
                <small>{c.value}</small>
              </span>
              <Icon name="arrow_outward" />
            </a>
          ))}
          {site.address && (
            <div className="contact-card">
              <span className="contact-icon">
                <Icon name="location_on" />
              </span>
              <span>
                <strong>Morada</strong>
                <small>{site.address}</small>
              </span>
            </div>
          )}
        </aside>
        <ContactForm />
      </div>
    </main>
  );
}
