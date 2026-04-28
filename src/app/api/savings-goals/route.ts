import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getOrCreateUser } from "@/lib/auth-user";
import {
  mapSavingsGoalDBToUI,
  mapSavingsGoalUIToDB,
} from "@/lib/mappers/savings-goal.mapper";
import { prisma } from "@/lib/prisma";
import { SavingsGoalSchema } from "@/lib/validators";

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

async function syncGoalTransactions(
  userId: string,
  goalId: string,
  transactionIds: string[]
) {
  const uniqueIds = Array.from(new Set(transactionIds));

  const lockedMovement = await prisma.savingsMovement.findFirst({
    where: {
      userId,
      goalId: {
        not: goalId,
      },
      transactionId: {
        in: uniqueIds,
      },
    },
    include: {
      goal: true,
    },
  });

  if (lockedMovement?.goal) {
    throw new Error(
      `Una transaccion ya pertenece a la meta ${lockedMovement.goal.name}`
    );
  }

  await prisma.savingsMovement.deleteMany({
    where: {
      userId,
      goalId,
      transactionId: {
        notIn: uniqueIds,
      },
    },
  });

  if (uniqueIds.length === 0) return;

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      id: {
        in: uniqueIds,
      },
    },
  });

  const transactionById = new Map(
    transactions.map((transaction) => [transaction.id, transaction])
  );

  for (const transactionId of uniqueIds) {
    const transaction = transactionById.get(transactionId);
    if (!transaction) continue;

    await prisma.savingsMovement.upsert({
      where: {
        transactionId,
      },
      update: {
        goalId,
        date: transaction.date,
        amount: transaction.amount,
        type: "APORTE",
        note: transaction.additionalDescription,
      },
      create: {
        userId,
        goalId,
        transactionId,
        date: transaction.date,
        amount: transaction.amount,
        type: "APORTE",
        note: transaction.additionalDescription,
      },
    });
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    const data = await prisma.savingsGoal.findMany({
      where: {
        userId: user.id,
      },
      include: {
        movements: {
          where: {
            transactionId: {
              not: null,
            },
          },
          orderBy: {
            date: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(
      { ok: true, data: data.map(mapSavingsGoalDBToUI) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("API /savings-goals GET error:", error);
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
    const parsed = SavingsGoalSchema.parse(body);
    const mapped = mapSavingsGoalUIToDB(parsed);

    const goal = await prisma.savingsGoal.create({
      data: {
        userId: user.id,
        name: mapped.name,
        target: mapped.target,
        initialBalance: mapped.initialBalance,
        deadline: mapped.deadline,
      },
      include: {
        movements: true,
      },
    });

    if (mapped.transactionIds.length > 0) {
      await syncGoalTransactions(user.id, goal.id, mapped.transactionIds);
    }

    const saved = await prisma.savingsGoal.findUniqueOrThrow({
      where: {
        id: goal.id,
      },
      include: {
        movements: true,
      },
    });

    return NextResponse.json({
      ok: true,
      id: saved.id,
      data: mapSavingsGoalDBToUI(saved),
    });
  } catch (error) {
    console.error("API /savings-goals POST error:", error);
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

    const parsed = SavingsGoalSchema.parse(body.goal);
    const mapped = mapSavingsGoalUIToDB(parsed);

    const existing = await prisma.savingsGoal.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new Error("No se encontro la meta.");
    }

    await prisma.savingsGoal.update({
      where: {
        id,
      },
      data: {
        name: mapped.name,
        target: mapped.target,
        initialBalance: mapped.initialBalance,
        deadline: mapped.deadline,
      },
    });

    await syncGoalTransactions(user.id, id, mapped.transactionIds);

    const saved = await prisma.savingsGoal.findUniqueOrThrow({
      where: {
        id,
      },
      include: {
        movements: true,
      },
    });

    return NextResponse.json({ ok: true, data: mapSavingsGoalDBToUI(saved) });
  } catch (error) {
    console.error("API /savings-goals PATCH error:", error);
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

    await prisma.savingsGoal.deleteMany({
      where: {
        id,
        userId: user.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API /savings-goals DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 400 }
    );
  }
}
