import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getOrCreateUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function decimalToNumber(value: { toNumber?: () => number; toString: () => string } | number | string | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value.toString());
}

function getMonthRange(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end, month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "https://finance-dashboard-eta-three.vercel.app";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401, headers: corsHeaders(request) }
      );
    }

    const user = await getOrCreateUser(session);
    const { start, end, month, year } = getMonthRange();

    const [monthlyTransactions, budgets, savingsGoals, debts, latestTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          date: {
            gte: start,
            lt: end,
          },
          paymentStatus: "PAGADO",
        },
        select: {
          type: true,
          amount: true,
        },
      }),
      prisma.budget.findMany({
        where: {
          userId: user.id,
          month,
          year,
        },
        select: {
          limit: true,
        },
      }),
      prisma.savingsGoal.findMany({
        where: {
          userId: user.id,
          isActive: true,
        },
        include: {
          movements: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.debt.findMany({
        where: {
          userId: user.id,
          currentBalance: {
            gt: 0,
          },
        },
        select: {
          currentBalance: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
        },
        include: {
          category: true,
        },
        orderBy: {
          date: "desc",
        },
        take: 5,
      }),
    ]);

    const monthlyIncome = monthlyTransactions
      .filter((transaction) => transaction.type === "INGRESO")
      .reduce((total, transaction) => total + decimalToNumber(transaction.amount), 0);

    const monthlySpending = monthlyTransactions
      .filter((transaction) => transaction.type === "GASTO")
      .reduce((total, transaction) => total + decimalToNumber(transaction.amount), 0);

    const monthlyBudget = budgets.reduce(
      (total, budget) => total + decimalToNumber(budget.limit),
      0
    );

    const activeSavingsGoals = savingsGoals.length;
    const topSavingsGoal = savingsGoals[0]
      ? {
          name: savingsGoals[0].name,
          target: decimalToNumber(savingsGoals[0].target),
          saved: savingsGoals[0].movements.reduce((total, movement) => {
            const amount = decimalToNumber(movement.amount);
            if (movement.type === "RETIRO") return total - amount;
            return total + amount;
          }, decimalToNumber(savingsGoals[0].initialBalance)),
        }
      : null;

    const activeDebtBalance = debts.reduce(
      (total, debt) => total + decimalToNumber(debt.currentBalance),
      0
    );

    return NextResponse.json(
      {
        ok: true,
        data: {
          month,
          year,
          monthlyIncome,
          monthlySpending,
          monthlyBalance: monthlyIncome - monthlySpending,
          monthlyBudget,
          budgetUsagePercent: monthlyBudget > 0 ? Math.round((monthlySpending / monthlyBudget) * 100) : 0,
          activeSavingsGoals,
          topSavingsGoal,
          activeDebtBalance,
          latestTransactions: latestTransactions.map((transaction) => ({
            id: transaction.id,
            date: transaction.date.toISOString().slice(0, 10),
            type: transaction.type,
            amount: decimalToNumber(transaction.amount),
            category: transaction.category.name,
            description: transaction.additionalDescription ?? "",
          })),
        },
      },
      { headers: { "Cache-Control": "no-store", ...corsHeaders(request) } }
    );
  } catch (error) {
    console.error("API /summary GET error:", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

