import dotenv from "dotenv";
import nodemailer from "nodemailer";
import path from "path";

export type WorkerApplicationNotificationStatus = "Approved" | "Rejected" | "Visit Required";

type WorkerStatusEmailParams = {
  workerEmail: string;
  workerName: string;
  applicationStatus: WorkerApplicationNotificationStatus;
  optionalMessage?: string;
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

export function isWorkerApplicationStatusNotifiable(
  status: string
): status is WorkerApplicationNotificationStatus {
  return status === "Approved" || status === "Rejected" || status === "Visit Required";
}

export async function sendEmail(to: string, subject: string, text: string): Promise<SendEmailResult> {
  const normalizedTo = String(to || "").trim();
  if (!normalizedTo) {
    return { sent: false, skipped: true, error: "Recipient email is missing." };
  }

  const activeTransporter = getTransporter();
  if (!activeTransporter) {
    // eslint-disable-next-line no-console
    console.log(`[Email Stub] To: ${normalizedTo}; Subject: ${subject}; Body: ${text}`);
    return { sent: false, skipped: true, error: "SMTP password is not configured." };
  }

  try {
    const smtpConfig = getSmtpConfig();
    await activeTransporter.sendMail({
      from: smtpConfig.from,
      to: normalizedTo,
      subject,
      text
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
