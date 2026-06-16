import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/auth-user";  
import { mapDBToUI, mapUIToDB } from "@/lib/mappers/transaction.mapper";
import { ensureRecurringTransactionSuggestions } from "@/lib/recurring-transactions";
import { TransactionSchema } from "@/lib/validators";


export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

type DebtImpact = {
  debtId?: string | null;
  amount: number;
  paymentStatus: "PAGADO" | "PENDIENTE";
  type: "INGRESO" | "GASTO";
};

function shouldApplyDebtPayment(tx: DebtImpact) {
  return tx.type === "GASTO" && tx.paymentStatus === "PAGADO" && Boolean(tx.debtId);
}

async function applyDebtPayment(
  db: Pick<typeof prisma, "debt">,
  userId: string,
  tx: DebtImpact,
  direction: "apply" | "reverse"
) {
  if (!shouldApplyDebtPayment(tx)) return;

  const debt = await db.debt.findFirst({
    where: {
      id: tx.debtId ?? "",
      userId,
    },
    select: {
      id: true,
      currentBalance: true,
    },
  });

  if (!debt) {
    throw new Error("La deuda seleccionada no existe o no pertenece al usuario.");
  }

  const currentBalance = Number(debt.currentBalance);
  const amount = Number(tx.amount) || 0;
  const nextBalance =
    direction === "apply"
      ? Math.max(0, currentBalance - amount)
      : currentBalance + amount;

  await db.debt.update({
    where: {
      id: debt.id,
    },
    data: {
      currentBalance: nextBalance,
    },
  });
}

type RecurringSuggestionDismissalWriter = {
  recurringSuggestionDismissal?: {
    upsert: (args: {
      where: {
        userId_recurrenceKey_date: {
          userId: string;
          recurrenceKey: string;
          date: Date;
        };
      };
      update: Record<string, never>;
      create: {
        userId: string;
        recurrenceKey: string;
        date: Date;
      };
    }) => Promise<unknown>;
  };
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
};

async function recordRecurringSuggestionDismissal(
  db: RecurringSuggestionDismissalWriter,
  userId: string,
  recurrenceKey: string,
  date: Date
) {
  if (db.recurringSuggestionDismissal) {
    await db.recurringSuggestionDismissal.upsert({
      where: {
        userId_recurrenceKey_date: {
          userId,
          recurrenceKey,
          date,
        },
      },
      update: {},
      create: {
        userId,
        recurrenceKey,
        date,
      },
    });
    return;
  }

  await db.$executeRawUnsafe(
    `INSERT INTO "RecurringSuggestionDismissal" ("id", "recurrenceKey", "date", "userId")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("userId", "recurrenceKey", "date") DO NOTHING`,
    randomUUID(),
    recurrenceKey,
    date,
    userId
  );
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

    const transaction = await prisma.$transaction(async (tx) => {
      await applyDebtPayment(tx, user.id, mapped, "apply");

      return tx.transaction.create({
        data: {
          date: mapped.date,
          type: mapped.type,
          amount: mapped.amount,
          paymentStatus: mapped.paymentStatus,
          additionalDescription: mapped.additionalDescription,
          debtId: mapped.debtId,
          debtInstallment: mapped.debtInstallment,
          userId: user.id,
          categoryId: category.id,
        },
        include: {
          category: true,
        },
      });
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

    const transaction = await prisma.$transaction(async (tx) => {
      const current = await tx.transaction.findFirst({
        where: {
          id,
          userId: user.id,
        },
        select: {
          id: true,
          type: true,
          amount: true,
          paymentStatus: true,
          debtId: true,
        },
      });

      if (!current) throw new Error("No se encontro la transaccion.");

      await applyDebtPayment(
        tx,
        user.id,
        {
          type: current.type,
          amount: Number(current.amount),
          paymentStatus: current.paymentStatus,
          debtId: current.debtId,
        },
        "reverse"
      );
      await applyDebtPayment(tx, user.id, mapped, "apply");

      return tx.transaction.update({
        where: {
          id,
        },
        data: {
          date: mapped.date,
          type: mapped.type,
          amount: mapped.amount,
          paymentStatus: mapped.paymentStatus,
          additionalDescription: mapped.additionalDescription,
          debtId: mapped.debtId,
          debtInstallment: mapped.debtInstallment,
          categoryId: category.id,
        },
        include: {
          category: true,
        },
      });
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

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const rawIds: unknown[] = Array.isArray(body.ids) ? body.ids : [body.id];
    const ids = Array.from(
      new Set(
        rawIds
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
      )
    );
    if (ids.length === 0) throw new Error("Falta 'id' para eliminar");

    const user = await getOrCreateUser(session);
    let deleted = 0;

    await prisma.$transaction(async (tx) => {
      const currentTransactions = await tx.transaction.findMany({
        where: {
          id: {
            in: ids,
          },
          userId: user.id,
        },
        select: {
          id: true,
          date: true,
          type: true,
          amount: true,
          paymentStatus: true,
          debtId: true,
          recurrenceKey: true,
          isRecurringSuggestion: true,
        },
      });

      if (currentTransactions.length === 0) {
        throw new Error("No se encontro la transaccion.");
      }

      for (const current of currentTransactions) {
        await applyDebtPayment(
          tx,
          user.id,
          {
            type: current.type,
            amount: Number(current.amount),
            paymentStatus: current.paymentStatus,
            debtId: current.debtId,
          },
          "reverse"
        );

        if (current.isRecurringSuggestion && current.recurrenceKey) {
          await recordRecurringSuggestionDismissal(
            tx as unknown as RecurringSuggestionDismissalWriter,
            user.id,
            current.recurrenceKey,
            current.date
          );
        }
      }

      await tx.savingsMovement.deleteMany({
        where: {
          transactionId: {
            in: currentTransactions.map((transaction) => transaction.id),
          },
          userId: user.id,
        },
      });

      const result = await tx.transaction.deleteMany({
        where: {
          id: {
            in: currentTransactions.map((transaction) => transaction.id),
          },
          userId: user.id,
        },
      });

      deleted = result.count;
    });

    return NextResponse.json({ ok: true, deleted });
  } catch (error: unknown) {
    console.error("API /transactions DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
