import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/auth-user";  
import { mapDBToUI, mapUIToDB } from "@/lib/mappers/transaction.mapper";
import { ensureRecurringTransactionSuggestions } from "@/lib/recurring-transactions";
import { TransactionSchema } from "@/lib/validators";


export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const user = await getOrCreateUser(session);
    await ensureRecurringTransactionSuggestions(user.id);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
      },
      include: {
        category: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json(
      { ok: true, data: transactions.map(mapDBToUI) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("API /transactions GET error:", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = TransactionSchema.parse(body);
    const user = await getOrCreateUser(session);
    const mapped = mapUIToDB(parsed);

    const category = await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId: user.id,
          name: mapped.categoryName,
          type: mapped.type,
        },
      },
      update: {
        isActive: true,
      },
      create: {
        userId: user.id,
        name: mapped.categoryName,
        type: mapped.type,
      },
    });

    const transaction = await prisma.transaction.create({
      data: {
        date: mapped.date,
        type: mapped.type,
        amount: mapped.amount,
        paymentStatus: mapped.paymentStatus,
        additionalDescription: mapped.additionalDescription,
        userId: user.id,
        categoryId: category.id,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json({
      ok: true,
      id: transaction.id,
      data: mapDBToUI(transaction),
    });
  } catch (error: unknown) {
    console.error("API /transactions POST error:", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const id = String(body.id ?? "").trim();
    if (!id) throw new Error("Falta 'id' para editar");

    const parsed = TransactionSchema.parse(body.transaction);
    const user = await getOrCreateUser(session);
    const mapped = mapUIToDB(parsed);

    const category = await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId: user.id,
          name: mapped.categoryName,
          type: mapped.type,
        },
      },
      update: {
        isActive: true,
      },
      create: {
        userId: user.id,
        name: mapped.categoryName,
        type: mapped.type,
      },
    });

    const transaction = await prisma.transaction.update({
      where: {
        id,
        userId: user.id,
      },
      data: {
        date: mapped.date,
        type: mapped.type,
        amount: mapped.amount,
        paymentStatus: mapped.paymentStatus,
        additionalDescription: mapped.additionalDescription,
        categoryId: category.id,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json({ ok: true, data: mapDBToUI(transaction) });
  } catch (error: unknown) {
    console.error("API /transactions PATCH error:", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
