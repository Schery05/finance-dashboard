import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

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
    const name = String(body.name ?? "").trim();
    const password = validatePassword(body.password);

    if (!email || !email.includes("@")) {
      throw new Error("Ingresa un correo valido.");
    }

    if (!name) {
      throw new Error("El nombre es obligatorio.");
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (existing?.passwordHash) {
      throw new Error("Ya existe una cuenta con este correo.");
    }

    const passwordHash = hashPassword(password);

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { name, passwordHash },
          select: { id: true, email: true, name: true },
        })
      : await prisma.user.create({
          data: { email, name, passwordHash },
          select: { id: true, email: true, name: true },
        });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    console.error("API /register error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 400 }
    );
  }
}
