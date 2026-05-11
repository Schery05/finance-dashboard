import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createPasswordResetToken,
  getPasswordResetExpiry,
  hashPasswordResetToken,
} from "@/lib/password-reset";
import {
  isPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from "@/lib/email";

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email);

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Ingresa un correo valido." },
        { status: 400 }
      );
    }

    if (!isPasswordResetEmailConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El envio de correos no esta configurado. Agrega RESEND_API_KEY en .env.local y reinicia el servidor.",
        },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, passwordHash: true },
    });

    if (user?.passwordHash) {
      const token = createPasswordResetToken();
      const tokenHash = hashPasswordResetToken(token);

      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt: getPasswordResetExpiry(),
          },
        }),
      ]);

      await sendPasswordResetEmail({
        to: user.email,
        token,
        name: user.name,
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        "Si el correo esta registrado, enviaremos un token de recuperacion.",
    });
  } catch (error) {
    console.error("API /password-reset/request error:", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar el token. Intenta nuevamente." },
      { status: 500 }
    );
  }
}
