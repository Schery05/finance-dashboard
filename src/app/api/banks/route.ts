import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getOrCreateUser } from "@/lib/auth-user";
import { DEFAULT_DOMINICAN_BANKS } from "@/lib/banks";
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

async function seedDefaultBanks(userId: string) {
  for (const name of DEFAULT_DOMINICAN_BANKS) {
    await prisma.bank.upsert({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
      update: {},
      create: {
        userId,
        name,
      },
    });
  }
}

async function getBanks(userId: string) {
  return prisma.bank.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    await seedDefaultBanks(user.id);
    const banks = await getBanks(user.id);

    return NextResponse.json(
      { ok: true, data: banks },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("API /banks GET error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    const body = await req.json();
    const name = String(body.name ?? "").trim();

    if (!name) throw new Error("El nombre del banco es obligatorio.");

    await prisma.bank.upsert({
      where: {
        userId_name: {
          userId: user.id,
          name,
        },
      },
      update: {
        isActive: true,
      },
      create: {
        userId: user.id,
        name,
      },
    });

    const banks = await getBanks(user.id);
    return NextResponse.json({ ok: true, data: banks });
  } catch (error) {
    console.error("API /banks POST error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 400 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    const body = await req.json();
    const id = String(body.id ?? "").trim();

    if (!id) throw new Error("Falta el banco a eliminar.");

    await prisma.bank.updateMany({
      where: {
        id,
        userId: user.id,
      },
      data: {
        isActive: false,
      },
    });

    const banks = await getBanks(user.id);
    return NextResponse.json({ ok: true, data: banks });
  } catch (error) {
    console.error("API /banks DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 400 }
    );
  }
}
