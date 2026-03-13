import dotenv from "dotenv";
import nodemailer from "nodemailer";
import path from "path";

export type WorkerApplicationNotificationStatus = "Approved" | "Rejected" | "Visit Scheduled";
export type TaskoAccountAudience = "user" | "worker";

type WorkerStatusEmailParams = {
  workerEmail: string;
  workerName: string;
  applicationStatus: WorkerApplicationNotificationStatus;
  visitOfficeAddress?: string;
  visitDate?: string;
  visitTime?: string;
};

type WorkerAccountCreatedEmailParams = {
  workerEmail: string;
  workerName: string;
  workerId: string;
  password: string;
  loginLink: string;
};

type PasswordResetEmailParams = {
  recipientEmail: string;
  recipientName?: string;
  resetUrl: string;
  expiresInMinutes: number;
  audience: TaskoAccountAudience;
};

type SendEmailContent = {
  text: string;
  html?: string;
};

type SendEmailResult = {
  sent: boolean;
  skipped: boolean;
  error?: string;
};

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

let transporter: nodemailer.Transporter | null = null;
let transporterConfigKey = "";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function getSmtpConfig(): SmtpConfig {
  const host = String(process.env.TASKO_SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.TASKO_SMTP_PORT || process.env.EMAIL_PORT || 587);
  const secure = String(process.env.TASKO_SMTP_SECURE || process.env.EMAIL_SECURE || "false")
    .trim()
    .toLowerCase() === "true";
  const user = String(process.env.TASKO_SMTP_USER || process.env.EMAIL_USER || "tasko.message@gmail.com").trim();
  const pass = String(process.env.TASKO_SMTP_PASS || process.env.EMAIL_PASS || "").trim();
  const from = String(process.env.TASKO_EMAIL_FROM || process.env.EMAIL_FROM || `Tasko Team <${user}>`).trim();

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    user,
    pass,
    from
  };
}

function getTransporter(): nodemailer.Transporter | null {
  const smtpConfig = getSmtpConfig();
  if (!smtpConfig.pass) {
    return null;
  }

  const nextConfigKey = JSON.stringify({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    user: smtpConfig.user,
    pass: smtpConfig.pass
  });

  if (transporter && transporterConfigKey === nextConfigKey) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    }
  });
  transporterConfigKey = nextConfigKey;
  return transporter;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEmailContent(content: string | SendEmailContent): SendEmailContent {
  if (typeof content === "string") {
    return { text: content };
  }

  return {
    text: String(content.text || "").trim(),
    html: typeof content.html === "string" ? content.html : undefined
  };
}

function getWorkerAppUrl(): string {
  return String(process.env.TASKO_WORKER_APP_URL || process.env.WORKER_APP_URL || "http://localhost:3001").trim();
}

function getWorkerLoginUrl(): string {
  return `${getWorkerAppUrl().replace(/\/+$/, "")}/login`;
}

function formatVisitDate(value: string): string {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return normalized;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function createTaskoEmailHtml({
  preheader,
  greeting,
  title,
  introLine,
  bodyLines,
  ctaLabel,
  ctaUrl,
  footerNote
}: {
  preheader: string;
  greeting: string;
  title: string;
  introLine?: string;
  bodyLines: string[];
  ctaLabel: string;
  ctaUrl: string;
  footerNote: string;
}): string {
  const safePreheader = escapeHtml(preheader);
  const safeGreeting = escapeHtml(greeting);
  const safeTitle = escapeHtml(title);
  const safeFooter = escapeHtml(footerNote).replace(/\n/g, "<br />");
  const safeIntroLine = String(introLine || "").trim();
  const introHtml = safeIntroLine
    ? `<p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.7;">${escapeHtml(safeIntroLine).replace(/\n/g, "<br />")}</p>`
    : "";
  const paragraphs = bodyLines
    .map(
      (line) =>
        `<p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.7;">${escapeHtml(line).replace(/\n/g, "<br />")}</p>`
    )
    .join("");

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4efe7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4efe7;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #eadfce;box-shadow:0 24px 60px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:24px 28px;background:linear-gradient(135deg,#1f2937,#3f3f46);color:#f9fafb;">
                <div style="font-size:12px;letter-spacing:0.32em;text-transform:uppercase;font-weight:700;color:#d6c39b;">Tasko</div>
                <div style="margin-top:10px;font-size:28px;line-height:1.2;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${safeTitle}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px;color:#111827;font-size:16px;line-height:1.7;font-weight:600;">${safeGreeting}</p>
                ${introHtml}
                ${paragraphs}
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 22px;">
                  <tr>
                    <td align="center" style="border-radius:999px;background:#c6a75e;">
                      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">${escapeHtml(ctaLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px;color:#6b7280;font-size:13px;line-height:1.6;word-break:break-all;">If the button does not work, copy and paste this link into your browser:<br />${escapeHtml(ctaUrl)}</p>
                <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">${safeFooter}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function createStatusEmailContent(params: WorkerStatusEmailParams): {
  subject: string;
  content: SendEmailContent;
} {
  const workerName = String(params.workerName || "").trim() || "Worker";

  if (params.applicationStatus === "Approved") {
    const subject = "Your Tasko Worker Application Has Been Approved";
    const text = `Hello ${workerName},

Good news!

Your application to join Tasko as a service worker has been approved.

As the next step in the onboarding process, you will need to visit our office for verification and final setup.

The exact date and time for the visit will be announced later. Our team will notify you soon with the schedule details.

Please keep an eye on your email for further instructions.

Best regards
Tasko Team`;

    return {
      subject,
      content: {
        text,
        html: createTaskoEmailHtml({
          preheader: "Your Tasko worker application has been approved.",
          greeting: `Hello ${workerName},`,
          title: "Application Approved",
          introLine: "Good news!",
          bodyLines: [
            "Your application to join Tasko as a service worker has been approved.",
            "As the next step in the onboarding process, you will need to visit our office for verification and final setup.",
            "The exact date and time for the visit will be announced later. Our team will notify you soon with the schedule details.",
            "Please keep an eye on your email for further instructions."
          ],
          ctaLabel: "Worker Portal",
          ctaUrl: getWorkerLoginUrl(),
          footerNote: "Best regards\nTasko Team"
        })
      }
    };
  }

  if (params.applicationStatus === "Visit Scheduled") {
    const visitOfficeAddress = String(params.visitOfficeAddress || "").trim();
    const visitDate = formatVisitDate(params.visitDate || "");
    const visitTime = String(params.visitTime || "").trim();
    const subject = "Tasko Worker Verification Visit Scheduled";
    const text = `Hello ${workerName},

Your worker application has passed the initial review and you are required to visit our office for identity verification and onboarding completion.

Visit Details

Office Address:
${visitOfficeAddress}

Date: ${visitDate}
Time: ${visitTime}

Please make sure to arrive on time. If you are unable to attend, please contact the Tasko team.

We look forward to meeting you.

Best regards
Tasko Team`;

    return {
      subject,
      content: {
        text,
        html: createTaskoEmailHtml({
          preheader: "Your Tasko verification visit has been scheduled.",
          greeting: `Hello ${workerName},`,
          title: "Verification Visit Scheduled",
          bodyLines: [
            "Your worker application has passed the initial review and you are required to visit our office for identity verification and onboarding completion.",
            `Visit Details\n\nOffice Address:\n${visitOfficeAddress}\n\nDate: ${visitDate}\nTime: ${visitTime}`,
            "Please make sure to arrive on time. If you are unable to attend, please contact the Tasko team.",
            "We look forward to meeting you."
          ],
          ctaLabel: "Worker Portal",
          ctaUrl: getWorkerLoginUrl(),
          footerNote: "Best regards\nTasko Team"
        })
      }
    };
  }

  const subject = "Update on Your Tasko Worker Application";
  const text = `Hello ${workerName},

Thank you for applying to join Tasko as a service worker.

After reviewing your application and evaluation results, we regret to inform you that your application has not been approved at this time.

You may apply again in the future.

We appreciate your interest in Tasko.

Best regards
Tasko Team`;

  return {
    subject,
    content: {
      text,
      html: createTaskoEmailHtml({
        preheader: "There is an update on your Tasko worker application.",
        greeting: `Hello ${workerName},`,
        title: "Application Update",
        bodyLines: [
          "Thank you for applying to join Tasko as a service worker.",
          "After reviewing your application and evaluation results, we regret to inform you that your application has not been approved at this time.",
          "You may apply again in the future.",
          "We appreciate your interest in Tasko."
        ],
        ctaLabel: "Tasko",
        ctaUrl: getWorkerAppUrl(),
        footerNote: "Best regards\nTasko Team"
      })
    }
  };
}

function createWorkerAccountCreatedEmailContent(
  params: WorkerAccountCreatedEmailParams
): { subject: string; content: SendEmailContent } {
  const workerName = String(params.workerName || "").trim() || "Worker";
  const workerId = String(params.workerId || "").trim();
  const password = String(params.password || "").trim();
  const loginLink = String(params.loginLink || "").trim();
  const subject = "Your Tasko Worker Account Has Been Created";
  const text = `Hello ${workerName},

Congratulations!

Your Tasko worker account has been successfully created and you can now log in to the Tasko worker platform.

Your Login Credentials

Worker ID: ${workerId}
Password: ${password}

You can log in using the following link:

${loginLink}

For security reasons, please change your password after your first login.

Welcome to the Tasko worker network.

Best regards
Tasko Team`;

  return {
    subject,
    content: {
      text,
      html: createTaskoEmailHtml({
        preheader: "Your Tasko worker account is ready.",
        greeting: `Hello ${workerName},`,
        title: "Worker Account Created",
        introLine: "Congratulations!",
        bodyLines: [
          "Your Tasko worker account has been successfully created and you can now log in to the Tasko worker platform.",
          `Your Login Credentials\n\nWorker ID: ${workerId}\nPassword: ${password}`,
          `You can log in using the following link:\n\n${loginLink}`,
          "For security reasons, please change your password after your first login.",
          "Welcome to the Tasko worker network."
        ],
        ctaLabel: "Open Login",
        ctaUrl: loginLink,
        footerNote: "Best regards\nTasko Team"
      })
    }
  };
}

function createPasswordResetEmailContent(params: PasswordResetEmailParams): {
  subject: string;
  content: SendEmailContent;
} {
  const recipientName = String(params.recipientName || "").trim() || "Tasko member";
  const audienceLabel = params.audience === "worker" ? "Tasko Worker" : "Tasko";
  const subject = `${audienceLabel} Password Reset`;
  const text = `Hello ${recipientName},

We received a request to reset the password for your ${audienceLabel} account.

Use the secure link below to choose a new password:
${params.resetUrl}

This link will expire in ${params.expiresInMinutes} minutes and can only be used once.

If you did not request a password reset, you can safely ignore this email.

Regards,
Tasko Team`;
  const html = createTaskoEmailHtml({
    preheader: `Your secure password reset link expires in ${params.expiresInMinutes} minutes.`,
    greeting: `Hello ${recipientName},`,
    title: "Password Reset Request",
    bodyLines: [
      `We received a request to reset the password for your ${audienceLabel} account.`,
      `Use the secure link below to choose a new password. This link expires in ${params.expiresInMinutes} minutes and can only be used once.`,
      "If you did not request this change, you can ignore this email and your current password will remain unchanged."
    ],
    ctaLabel: "Reset Password",
    ctaUrl: params.resetUrl,
    footerNote: "For security reasons, please do not share this link with anyone."
  });

  return {
    subject,
    content: {
      text,
      html
    }
  };
}

export function isWorkerApplicationStatusNotifiable(
  status: string
): status is WorkerApplicationNotificationStatus {
  return status === "Approved" || status === "Rejected" || status === "Visit Scheduled";
}

export async function sendEmail(
  to: string,
  subject: string,
  content: string | SendEmailContent
): Promise<SendEmailResult> {
  const normalizedTo = String(to || "").trim();
  if (!normalizedTo) {
    return { sent: false, skipped: true, error: "Recipient email is missing." };
  }

  const normalizedContent = normalizeEmailContent(content);
  const activeTransporter = getTransporter();
  if (!activeTransporter) {
    // eslint-disable-next-line no-console
    console.log(`[Email Stub] To: ${normalizedTo}; Subject: ${subject}; Body: ${normalizedContent.text}`);
    return { sent: false, skipped: true, error: "SMTP password is not configured." };
  }

  try {
    const smtpConfig = getSmtpConfig();
    await activeTransporter.sendMail({
      from: smtpConfig.from,
      to: normalizedTo,
      subject,
      text: normalizedContent.text,
      html: normalizedContent.html
    });
    return { sent: true, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { sent: false, skipped: false, error: message };
  }
}

export async function sendWorkerApplicationStatusEmail(
  params: WorkerStatusEmailParams
): Promise<SendEmailResult> {
  const { subject, content } = createStatusEmailContent(params);
  return sendEmail(params.workerEmail, subject, content);
}

export async function sendWorkerAccountCreatedEmail(
  params: WorkerAccountCreatedEmailParams
): Promise<SendEmailResult> {
  const { subject, content } = createWorkerAccountCreatedEmailContent(params);
  return sendEmail(params.workerEmail, subject, content);
}

export async function sendPasswordResetEmail(
  params: PasswordResetEmailParams
): Promise<SendEmailResult> {
  const { subject, content } = createPasswordResetEmailContent(params);
  return sendEmail(params.recipientEmail, subject, content);
}
