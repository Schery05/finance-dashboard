import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getOrCreateUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

async function getAuthenticatedUser() {
  const session = await getServerSession();
  if (!session) throw new Error("No autorizado");
  return getOrCreateUser(session);
}

function normalizeIds(value: unknown) {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const read = await prisma.readNotification.findMany({
      where: { userId: user.id },
      select: { notificationId: true },
    });

    return NextResponse.json({
      ok: true,
      data: read.map((item) => item.notificationId),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    const body = await req.json();
    const ids = normalizeIds(body.notificationIds ?? body.notificationId);

    if (ids.length === 0) {
      throw new Error("No hay notificaciones para marcar como leidas.");
    }

    await prisma.$transaction(
      ids.map((notificationId) =>
        prisma.readNotification.upsert({
          where: {
            userId_notificationId: {
              userId: user.id,
              notificationId,
            },
          },
          update: { readAt: new Date() },
          create: {
            userId: user.id,
            notificationId,
          },
        })
      )
    );

    return NextResponse.json({ ok: true, data: ids });
  } catch (error) {
    console.error("API /notifications/read POST error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 400 }
    );
  }
}
