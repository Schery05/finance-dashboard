import { NextResponse } from "next/server";
import { readTransactions, appendTransaction, updateTransactionById } from "@/lib/sheets";
import { TransactionSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await readTransactions();
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error("API /transactions GET error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = TransactionSchema.parse(body);

    const id = crypto.randomUUID(); // Node/Next server

    await appendTransaction({
      ID: id,
      ...parsed,
      DescripcionAdicional: parsed.DescripcionAdicional ?? "",
    });

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    console.error("API /transactions POST error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    const id = String(body.id ?? "").trim();
    if (!id) throw new Error("Falta 'id' para editar");

    const parsed = TransactionSchema.parse(body.transaction);

    await updateTransactionById(id, {
      ...parsed,
      DescripcionAdicional: parsed.DescripcionAdicional ?? "",
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("API /transactions PATCH error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 400 });
  }
}