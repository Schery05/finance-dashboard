import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getOrCreateUser } from "@/lib/auth-user";
import { parseDebtHistoryPaymentsFromText } from "@/lib/debt-history-import";
import { extractTextFromPdf } from "@/lib/pdf-text";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

function mapStatusToDB(status: "Pagado" | "Pendiente") {
  return status === "Pagado" ? "PAGADO" : "PENDIENTE";
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;
    const form = await req.formData();
    const mode = String(form.get("mode") ?? "preview");
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new Error("Selecciona un archivo PDF para importar.");
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("El archivo debe estar en formato PDF.");
    }

    const user = await getOrCreateUser(session);
    const debt = await prisma.debt.findFirst({
      where: { id, userId: user.id },
      select: { id: true, currentBalance: true },
    });
    if (!debt) throw new Error("El prestamo no existe o no pertenece al usuario.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = extractTextFromPdf(buffer);
    const rows = parseDebtHistoryPaymentsFromText(text);

    if (rows.length === 0) {
      throw new Error("No se detectaron transacciones de pago en el PDF.");
    }

    if (mode !== "import") {
      return NextResponse.json({
        ok: true,
        data: {
          rows,
          total: rows.length,
        },
      });
    }

    let created = 0;
    let skipped = 0;

    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.category.upsert({
        where: {
          userId_name_type: {
            userId: user.id,
            name: "Pago Prestamo",
            type: "GASTO",
          },
        },
        update: { isActive: true },
        create: {
          userId: user.id,
          name: "Pago Prestamo",
          type: "GASTO",
        },
        select: { id: true },
      });

      let paidAmount = 0;

      for (const row of rows) {
        const existing = await tx.transaction.findFirst({
          where: {
            userId: user.id,
            debtId: debt.id,
            date: new Date(`${row.date}T00:00:00.000Z`),
            amount: row.amount,
            additionalDescription: row.description,
          },
          select: { id: true },
        });

        if (existing) {
          skipped += 1;
          continue;
        }

        await tx.transaction.create({
          data: {
            userId: user.id,
            categoryId: category.id,
            debtId: debt.id,
            debtInstallment: row.installment,
            date: new Date(`${row.date}T00:00:00.000Z`),
            type: "GASTO",
            amount: row.amount,
            paymentStatus: mapStatusToDB(row.status),
            additionalDescription: row.description,
          },
        });

        if (row.status === "Pagado") paidAmount += row.amount;
        created += 1;
      }

      if (paidAmount > 0) {
        await tx.debt.update({
          where: { id: debt.id },
          data: {
            currentBalance: Math.max(0, Number(debt.currentBalance) - paidAmount),
          },
        });
      }

      return { created, skipped, total: rows.length };
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error("API /debts/[id]/history-import POST error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 400 }
    );
  }
}
