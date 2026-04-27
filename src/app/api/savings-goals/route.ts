import { NextResponse } from "next/server";
import {
  appendSavingsGoal,
  deleteSavingsGoalById,
  readSavingsGoals,
  updateSavingsGoalById,
} from "@/lib/sheets";
import { SavingsGoalSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

export async function GET() {
  try {
    const data = await readSavingsGoals();
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("API /savings-goals GET error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = SavingsGoalSchema.parse(body);
    const id = crypto.randomUUID();

    await appendSavingsGoal({
      ID: id,
      Nombre: parsed.Nombre,
      MontoObjetivo: parsed.MontoObjetivo,
      FechaLimite: parsed.FechaLimite,
      TransaccionesAsociadas: parsed.TransaccionesAsociadas,
      CreadoEn: new Date().toISOString(),
      SaldoInicial: parsed.SaldoInicial,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("API /savings-goals POST error:", error);
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

    const parsed = SavingsGoalSchema.parse(body.goal);
    const creadoEn = String(body.goal?.CreadoEn ?? body.goal?.createdAt ?? "");

    await updateSavingsGoalById(id, {
      Nombre: parsed.Nombre,
      MontoObjetivo: parsed.MontoObjetivo,
      FechaLimite: parsed.FechaLimite,
      TransaccionesAsociadas: parsed.TransaccionesAsociadas,
      CreadoEn: creadoEn || new Date().toISOString(),
      SaldoInicial: parsed.SaldoInicial,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API /savings-goals PATCH error:", error);
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

    await deleteSavingsGoalById(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API /savings-goals DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 400 }
    );
  }
}
