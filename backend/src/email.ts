import nodemailer from 'nodemailer';

export async function sendEmail(to: string, subject: string, text: string) {
  const from = process.env.MAIL_FROM;
  if (process.env.RESEND_API_KEY && from) {
    const response = await fetch('https://api.resend.com/emails', { method:'POST', headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'}, body:JSON.stringify({from,to,subject,text}) });
    if (!response.ok) throw new Error('Email delivery failed');
    return;
  }
  if (!from || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_PORT) throw new Error('Email service is not configured');
  const transport = nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
  await transport.sendMail({from,to,subject,text});
}
