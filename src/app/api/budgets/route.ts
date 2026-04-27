import { NextResponse } from "next/server";
import {
  appendBudget,
  deleteBudgetById,
  readBudgets,
  updateBudgetById,
} from "@/lib/sheets";
import { BudgetSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

export async function GET() {
  try {
    const data = await readBudgets();
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("API /budgets GET error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = BudgetSchema.parse(body);
    const id = crypto.randomUUID();

    await appendBudget({
      id,
      category: parsed.category,
      monthlyLimit: parsed.monthlyLimit,
      period: parsed.period,
      createdAt: parsed.createdAt || new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("API /budgets POST error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 400 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body.id ?? "").trim();
    if (!id) throw new Error("Falta 'id' para editar");

    const parsed = BudgetSchema.parse(body.budget);

    await updateBudgetById(id, {
      category: parsed.category,
      monthlyLimit: parsed.monthlyLimit,
      period: parsed.period,
      createdAt: parsed.createdAt || new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API /budgets PATCH error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const id = String(body.id ?? "").trim();
    if (!id) throw new Error("Falta 'id' para eliminar");

    await deleteBudgetById(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API /budgets DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 400 }
    );
  }
}
