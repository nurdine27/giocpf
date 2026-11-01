/** Branded transactional e-mails. Every template returns both HTML and plain text. */

const BRAND = {
  green: '#12352e',
  green2: '#234d40',
  lime: '#d8ef75',
  paper: '#f8f8f3',
  muted: '#66736d',
};
const SITE_NAME = 'GIO Centro de Formação';

function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function paragraphs(text: string) {
  return escape(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function siteUrl(path = '') {
  return `${(process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')}${path}`;
}

type Layout = {
  preheader: string;
  title: string;
  body: string;
  cta?: { label: string; href: string };
};

function layout({ preheader, title, body, cta }: Layout) {
  return `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.paper};font-family:Arial,Helvetica,sans-serif;color:#1d2925">
<span style="display:none;max-height:0;overflow:hidden">${escape(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e8df">
<tr><td style="background:${BRAND.green};padding:20px 28px;color:#fff;font-weight:bold;letter-spacing:.06em;font-size:18px">GIO <span style="display:block;font-size:10px;letter-spacing:.14em;color:${BRAND.lime}">CENTRO DE FORMAÇÃO</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${BRAND.green}">${escape(title)}</h1>
${body}
${cta ? `<p style="margin:24px 0 0"><a href="${escape(cta.href)}" style="display:inline-block;background:${BRAND.green};color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">${escape(cta.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 28px;background:${BRAND.paper};color:${BRAND.muted};font-size:12px;line-height:1.5">${SITE_NAME} · <a href="${siteUrl()}" style="color:${BRAND.green2}">${escape(siteUrl().replace(/^https?:\/\//, ''))}</a><br>Recebeu este e-mail porque interagiu com o ${SITE_NAME}.</td></tr>
</table></td></tr></table></body></html>`;
}

function infoTable(rows: [string, string | null | undefined][]) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;border-collapse:collapse">${rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eef0ea;color:${BRAND.muted};font-size:13px;width:38%">${escape(k)}</td><td style="padding:8px 0;border-bottom:1px solid #eef0ea;font-weight:bold;font-size:14px">${escape(v!)}</td></tr>`,
    )
    .join('')}</table>`;
}

function textRows(rows: [string, string | null | undefined][]) {
  return rows
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

export function passwordResetEmail(code: string) {
  const title = 'Código de recuperação';
  return {
    subject: `${code} é o seu código de recuperação — GIO CPF`,
    html: layout({
      preheader: `O seu código expira em 10 minutos.`,
      title,
      body: `<p style="margin:0 0 14px">Use o código abaixo para definir uma nova palavra-passe na área administrativa.</p>
<p style="margin:0 0 14px;font-size:32px;font-weight:bold;letter-spacing:.3em;color:${BRAND.green}">${escape(code)}</p>
<p style="margin:0;color:${BRAND.muted};font-size:13px">O código expira em 10 minutos. Se não pediu esta alteração, ignore este e-mail.</p>`,
    }),
    text: `${title}\n\nCódigo: ${code}\nExpira em 10 minutos. Se não pediu esta alteração, ignore este e-mail.`,
  };
}

type ContactMessage = {
  name: string;
  email: string;
  subject: string;
  category: string;
  body: string;
};

export function contactNotificationEmail(m: ContactMessage) {
  const rows: [string, string][] = [
    ['Nome', m.name],
    ['E-mail', m.email],
    ['Categoria', m.category],
  ];
  return {
    subject: `Nova mensagem: ${m.subject}`,
    html: layout({
      preheader: `${m.name} enviou uma mensagem pelo site.`,
      title: m.subject,
      body: infoTable(rows) + paragraphs(m.body),
      cta: { label: 'Abrir caixa de mensagens', href: siteUrl('/admin/mensagens') },
    }),
    text: `Nova mensagem do site\n\n${textRows(rows)}\n\n${m.body}\n\n${siteUrl('/admin/mensagens')}`,
  };
}

export function contactReplyEmail(m: ContactMessage, reply: string, adminName: string) {
  return {
    subject: `Re: ${m.subject}`,
    html: layout({
      preheader: reply.slice(0, 120),
      title: `Olá, ${m.name.split(' ')[0]}`,
      body: `${paragraphs(reply)}<p style="margin:18px 0 0;color:${BRAND.muted};font-size:13px">— ${escape(adminName)}, ${SITE_NAME}</p>
<div style="margin-top:22px;padding:14px;border-left:3px solid #d5dccf;background:${BRAND.paper};color:${BRAND.muted};font-size:13px"><strong>A sua mensagem:</strong><br>${escape(m.body).replace(/\n/g, '<br>')}</div>`,
    }),
    text: `Olá, ${m.name}\n\n${reply}\n\n— ${adminName}, ${SITE_NAME}\n\n--- A sua mensagem ---\n${m.body}`,
  };
}

type Registration = {
  reference: string;
  name: string;
  phone: string;
  email?: string | null;
  courseName: string;
  area: string;
  province: string;
  district: string;
  campusName?: string | null;
  className?: string | null;
  startsAt?: Date | null;
  waitlisted?: boolean;
};

function formatDay(date?: Date | null) {
  return date
    ? date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
}

function placementText(r: Registration) {
  return r.waitlisted
    ? 'Neste momento não há vagas disponíveis. Ficou em lista de espera e será colocado(a) na próxima turma com vagas.'
    : null;
}

export function registrationReceivedEmail(r: Registration) {
  const rows: [string, string | null | undefined][] = [
    ['Referência', r.reference],
    ['Curso', r.courseName],
    ['Pólo', r.campusName],
    ['Turma', r.waitlisted ? 'Lista de espera' : r.className],
    ['Início das aulas', formatDay(r.startsAt)],
  ];
  const waiting = placementText(r);
  return {
    subject: `Inscrição recebida — ${r.courseName}`,
    html: layout({
      preheader: `Referência ${r.reference}. Entraremos em contacto em breve.`,
      title: `Obrigado, ${r.name.split(' ')[0]}!`,
      body: `<p style="margin:0 0 14px">Recebemos a sua inscrição. A nossa equipa entrará em contacto para confirmar a vaga e os documentos necessários.</p>${infoTable(rows)}${waiting ? `<p style="margin:0 0 14px;padding:12px;border-radius:6px;background:#fbf1d9;color:#7a5405">${escape(waiting)}</p>` : ''}<p style="margin:0;color:${BRAND.muted};font-size:13px">Guarde a referência para qualquer contacto connosco.</p>`,
      cta: { label: 'Ver cursos', href: siteUrl('/cursos') },
    }),
    text: `Obrigado, ${r.name}!\n\nRecebemos a sua inscrição.\n\n${textRows(rows)}${waiting ? `\n\n${waiting}` : ''}\n\nA nossa equipa entrará em contacto em breve.`,
  };
}

export function registrationNotificationEmail(r: Registration & { id: string }) {
  const rows: [string, string | null | undefined][] = [
    ['Referência', r.reference],
    ['Candidato', r.name],
    ['Telefone', r.phone],
    ['E-mail', r.email],
    ['Curso', r.courseName],
    ['Pólo', r.campusName],
    ['Turma', r.waitlisted ? 'Lista de espera (sem vagas)' : r.className],
    ['Residência', `${r.district}, ${r.province}`],
  ];
  return {
    subject: `Nova inscrição: ${r.name} — ${r.courseName}`,
    html: layout({
      preheader: `${r.name} inscreveu-se em ${r.courseName}.`,
      title: 'Nova inscrição recebida',
      body: infoTable(rows),
      cta: { label: 'Analisar inscrição', href: siteUrl(`/admin/inscricoes/${r.id}`) },
    }),
    text: `Nova inscrição\n\n${textRows(rows)}\n\n${siteUrl(`/admin/inscricoes/${r.id}`)}`,
  };
}

export function testEmail(adminName: string) {
  return {
    subject: 'Teste de envio — GIO CPF',
    html: layout({
      preheader: 'O envio de e-mail está a funcionar.',
      title: 'Envio de e-mail configurado',
      body: `<p style="margin:0">Olá, ${escape(adminName)}. Se está a ler esta mensagem, as notificações do GIO CPF estão a funcionar.</p>`,
    }),
    text: `Olá, ${adminName}. Se está a ler esta mensagem, as notificações do GIO CPF estão a funcionar.`,
  };
}
