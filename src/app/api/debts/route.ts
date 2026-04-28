import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getOrCreateUser } from "@/lib/auth-user";
import { mapDebtDBToUI, mapDebtUIToDB } from "@/lib/mappers/debt.mapper";
import { prisma } from "@/lib/prisma";
import { DebtSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

async function getAuthenticatedUser() {
  const session = await getServerSession();
  if (!session) throw new Error("No autorizado");
  return getOrCreateUser(session);
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const debts = await prisma.debt.findMany({
      where: { userId: user.id },
      orderBy: [{ currentBalance: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(
      { ok: true, data: debts.map(mapDebtDBToUI) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("API /debts GET error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    const parsed = DebtSchema.parse(await req.json());
    const mapped = mapDebtUIToDB(parsed);

    const debt = await prisma.debt.create({
      data: {
        ...mapped,
        userId: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      id: debt.id,
      data: mapDebtDBToUI(debt),
    });
  } catch (error) {
    console.error("API /debts POST error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 400 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    const body = await req.json();
    const id = String(body.id ?? "").trim();
    if (!id) throw new Error("Falta 'id' para editar");

    const parsed = DebtSchema.parse(body.debt);
    const mapped = mapDebtUIToDB(parsed);

    const existing = await prisma.debt.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) throw new Error("No se encontro la deuda.");

    const debt = await prisma.debt.update({
      where: { id },
      data: mapped,
    });

    return NextResponse.json({ ok: true, data: mapDebtDBToUI(debt) });
  } catch (error) {
    console.error("API /debts PATCH error:", error);
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
    if (!id) throw new Error("Falta 'id' para eliminar");

    await prisma.debt.deleteMany({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API /debts DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 400 }
    );
  }
}
