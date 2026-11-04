import nodemailer from "nodemailer";

// Any SMTP server works: Mailpit in Docker Compose (inbox at http://localhost:8025), a free tier
// of Brevo/Resend/SES in production. Without SMTP_HOST outside production, mail goes to the server log.
const host = process.env.SMTP_HOST;
const from = process.env.MAIL_FROM ?? "EduHub <no-reply@eduhub.local>";

const transport = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    })
    : null;

const escapeHtml = (text: string) =>
    text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendEmail({ to, subject, text, link }: { to: string; subject: string; text: string; link: string }) {
    if (!transport) {
        if (process.env.NODE_ENV === "production") throw new Error("SMTP_HOST is not set, so email can't be sent.");
        console.info(`[mail] to ${to}: ${subject}\n${text}\n${link}`);
        return;
    }
    await transport.sendMail({
        from,
        to,
        subject,
        text: `${text}\n\n${link}`,
        html: `<p>${escapeHtml(text)}</p><p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
    });
}
