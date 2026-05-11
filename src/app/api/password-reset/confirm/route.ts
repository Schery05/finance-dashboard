import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { hashPasswordResetToken } from "@/lib/password-reset";

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function validatePassword(value: unknown) {
  const password = String(value ?? "");
  if (password.length < 8) {
    throw new Error("La contrasena debe tener al menos 8 caracteres.");
  }
  return password;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email);
    const token = String(body.token ?? "").trim();
    const password = validatePassword(body.password);

    if (!email || !email.includes("@")) {
      throw new Error("Ingresa un correo valido.");
    }

    if (!/^\d{6}$/.test(token)) {
      throw new Error("Ingresa el token de 6 digitos.");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      throw new Error("Token invalido o vencido.");
    }

    const tokenHash = hashPasswordResetToken(token);
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!resetToken) {
      throw new Error("Token invalido o vencido.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(password) },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, expiresAt: { lt: new Date() } },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Contrasena actualizada correctamente.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo actualizar.",
      },
      { status: 400 }
    );
  }
}
