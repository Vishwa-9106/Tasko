import dotenv from "dotenv";
import nodemailer from "nodemailer";
import path from "path";

export type WorkerApplicationNotificationStatus = "Approved" | "Rejected" | "Visit Required";
export type TaskoAccountAudience = "user" | "worker";

type WorkerStatusEmailParams = {
  workerEmail: string;
  workerName: string;
  applicationStatus: WorkerApplicationNotificationStatus;
  optionalMessage?: string;
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

function withOptionalMessage(baseText: string, optionalMessage?: string): string {
  const note = String(optionalMessage || "").trim();
  if (!note) return baseText;
  return `${baseText}\n\nAdditional Note:\n${note}`;
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

function createTaskoEmailHtml({
  preheader,
  greeting,
  title,
  bodyLines,
  ctaLabel,
  ctaUrl,
  footerNote
}: {
  preheader: string;
  greeting: string;
  title: string;
  bodyLines: string[];
  ctaLabel: string;
  ctaUrl: string;
  footerNote: string;
}): string {
  const safePreheader = escapeHtml(preheader);
  const safeGreeting = escapeHtml(greeting);
  const safeTitle = escapeHtml(title);
  const safeFooter = escapeHtml(footerNote);
  const paragraphs = bodyLines.map((line) => `<p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.7;">${escapeHtml(line)}</p>`).join("");

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

function createStatusEmailContent(
  workerName: string,
  applicationStatus: WorkerApplicationNotificationStatus,
  optionalMessage?: string
): { subject: string; text: string } {
  if (applicationStatus === "Rejected") {
    return {
      subject: "Tasko Worker Application Update",
      text: withOptionalMessage(
        `Hello ${workerName},

Thank you for applying to become a worker on Tasko.

After reviewing your application and test results, we regret to inform you that your application has been rejected at this time.

You may reapply in the future after improving your skills.

Regards,
Tasko Team`,
        optionalMessage
      )
    };
  }

  if (applicationStatus === "Visit Required") {
    return {
      subject: "Tasko Application - Visit Required",
      text: withOptionalMessage(
        `Hello ${workerName},

Your Tasko worker application has been reviewed.

Before approval, a verification visit is required. Our team may contact you shortly for further verification.

Please keep your phone available.

Regards,
Tasko Team`,
        optionalMessage
      )
    };
  }

  return {
    subject: "Welcome to Tasko",
    text: withOptionalMessage(
      `Hello ${workerName},

Congratulations! Your worker application has been approved.

You can now log in to the Tasko worker dashboard and start accepting jobs.

We wish you success working with Tasko.

Regards,
Tasko Team`,
      optionalMessage
    )
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
  return status === "Approved" || status === "Rejected" || status === "Visit Required";
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
  const workerName = String(params.workerName || "").trim() || "Applicant";
  const { subject, text } = createStatusEmailContent(
    workerName,
    params.applicationStatus,
    params.optionalMessage
  );
  return sendEmail(params.workerEmail, subject, text);
}

export async function sendPasswordResetEmail(
  params: PasswordResetEmailParams
): Promise<SendEmailResult> {
  const { subject, content } = createPasswordResetEmailContent(params);
  return sendEmail(params.recipientEmail, subject, content);
}
