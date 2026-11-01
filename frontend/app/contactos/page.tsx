import type { Metadata } from 'next';
import { Icon } from '@/components/icon';
import { ContactForm } from '@/components/contact-form';
export const metadata: Metadata = { title: 'Contactos' };
export default function Contactos() {
  return (
    <main id="conteudo" className="page-wrap">
      <div className="page-heading">
        <div className="section-kicker">FALE CONNOSCO</div>
        <h1>Estamos disponíveis para ajudar.</h1>
        <p>Contacte o GIO para esclarecer dúvidas sobre os cursos e as inscrições.</p>
      </div>
      <div className="contact-grid">
        <a className="contact-card" href="https://wa.me/258867268483">
          <Icon name="chat" />
          <h2>WhatsApp</h2>
          <p>+258 86 726 8483</p>
        </a>
        <a className="contact-card" href="mailto:giocentrodeformacao@gmail.com">
          <Icon name="mail" />
          <h2>E-mail</h2>
          <p>giocentrodeformacao@gmail.com</p>
        </a>
        <a className="contact-card" href="https://www.instagram.com/giocentrodeformacao/">
          <Icon name="photo_camera" />
          <h2>Instagram</h2>
          <p>@giocentrodeformacao</p>
        </a>
        <a
          className="contact-card"
          href="https://www.facebook.com/search/top?q=Gio%20Centro%20de%20Forma%C3%A7%C3%A3o"
        >
          <Icon name="public" />
          <h2>Facebook</h2>
          <p>Gio Centro de Formação</p>
        </a>
      </div>
      <ContactForm />
    </main>
  );
}
