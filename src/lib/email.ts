type PasswordResetEmailParams = {
  to: string;
  token: string;
  name?: string | null;
};

function getAppUrl() {
  return process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
}

export function isPasswordResetEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

async function sendWithResend({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "El servicio de correo no esta configurado. Agrega RESEND_API_KEY en .env.local."
    );
  }

  const from = process.env.EMAIL_FROM ?? "PropiaFinance <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`No se pudo enviar el correo: ${message}`);
  }

  return true;
}

export async function sendPasswordResetEmail({
  to,
  token,
  name,
}: PasswordResetEmailParams) {
  const displayName = name?.trim() || "usuario";
  const appUrl = getAppUrl();
  const subject = "Token para renovar tu contrasena - PropiaFinance";
  const text = [
    `Hola ${displayName},`,
    "",
    `Tu token para renovar la contrasena es: ${token}`,
    "Este token vence en 5 minutos.",
    "",
    `Vuelve a PropiaFinance para completar el cambio: ${appUrl}/login`,
    "",
    "Si no solicitaste este cambio, puedes ignorar este correo.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <h2 style="margin:0 0 12px">PropiaFinance</h2>
      <p>Hola ${displayName},</p>
      <p>Usa este token para renovar tu contrasena:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;background:#ecfeff;border-radius:14px;padding:14px 18px;display:inline-block">${token}</p>
      <p>Este token vence en <strong>5 minutos</strong>.</p>
      <p><a href="${appUrl}/login" style="color:#0891b2;font-weight:700">Volver a PropiaFinance</a></p>
      <p style="color:#64748b;font-size:13px">Si no solicitaste este cambio, puedes ignorar este correo.</p>
    </div>
  `;

  return sendWithResend({ to, subject, text, html });
}
