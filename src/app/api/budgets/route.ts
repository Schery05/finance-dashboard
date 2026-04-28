import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getOrCreateUser } from "@/lib/auth-user";
import {
  mapBudgetDBToUI,
  mapBudgetUIToDB,
} from "@/lib/mappers/budget.mapper";
import { prisma } from "@/lib/prisma";
import { BudgetSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

async function getAuthenticatedUser() {
  const session = await getServerSession();

  if (!session) {
    throw new Error("No autorizado");
  }

  return getOrCreateUser(session);
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    const budgets = await prisma.budget.findMany({
      where: {
        userId: user.id,
      },
      include: {
        category: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { category: { name: "asc" } }],
    });

    return NextResponse.json(
      { ok: true, data: budgets.map(mapBudgetDBToUI) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("API /budgets GET error:", error);
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
    const parsed = BudgetSchema.parse(body);
    const mapped = mapBudgetUIToDB(parsed);

    const category = await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId: user.id,
          name: mapped.categoryName,
          type: "GASTO",
        },
      },
      update: {
        isActive: true,
      },
      create: {
        userId: user.id,
        name: mapped.categoryName,
        type: "GASTO",
      },
    });

    const budget = await prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        month: mapped.month,
        year: mapped.year,
        limit: mapped.limit,
        ...(mapped.createdAt ? { createdAt: mapped.createdAt } : {}),
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json({
      ok: true,
      id: budget.id,
      data: mapBudgetDBToUI(budget),
    });
  } catch (error) {
    console.error("API /budgets POST error:", error);
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

    const parsed = BudgetSchema.parse(body.budget);
    const mapped = mapBudgetUIToDB(parsed);

    const existing = await prisma.budget.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new Error("No se encontro el presupuesto.");
    }

    const category = await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId: user.id,
          name: mapped.categoryName,
          type: "GASTO",
        },
      },
      update: {
        isActive: true,
      },
      create: {
        userId: user.id,
        name: mapped.categoryName,
        type: "GASTO",
      },
    });

    const budget = await prisma.budget.update({
      where: {
        id,
      },
      data: {
        categoryId: category.id,
        month: mapped.month,
        year: mapped.year,
        limit: mapped.limit,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json({ ok: true, data: mapBudgetDBToUI(budget) });
  } catch (error) {
    console.error("API /budgets PATCH error:", error);
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

    await prisma.budget.deleteMany({
      where: {
        id,
        userId: user.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API /budgets DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 400 }
    );
  }
}
