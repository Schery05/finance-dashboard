import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getOrCreateUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

function mapStatusToDB(value: unknown) {
  const status = String(value ?? "").trim();
  if (status === "Pagado") return "PAGADO";
  if (status === "Pendiente") return "PENDIENTE";
  throw new Error("Selecciona un estado valido.");
}

type DebtForRecalculation = {
  initialAmount: unknown;
  interestRate: unknown;
  monthlyPayment: unknown;
  payments: Array<{
    amount: unknown;
    paymentStatus: string;
    type: string;
    debtInstallment: number | null;
  }>;
  installmentStatuses: Array<{
    installment: number;
    status: string;
  }>;
};

function recalculateCurrentBalance(debt: DebtForRecalculation) {
  const initialAmount = Number(debt.initialAmount) || 0;
  const monthlyPayment = Number(debt.monthlyPayment) || 0;
  const monthlyRate = (Number(debt.interestRate) || 0) / 100 / 12;

  if (initialAmount <= 0 || monthlyPayment <= 0) return initialAmount;

  const paidByInstallment = new Map<number, number>();
  for (const payment of debt.payments) {
    if (payment.type !== "GASTO" || payment.paymentStatus !== "PAGADO") continue;

    const installment = Math.max(Number(payment.debtInstallment) || 1, 1);
    paidByInstallment.set(
      installment,
      (paidByInstallment.get(installment) ?? 0) + (Number(payment.amount) || 0)
    );
  }

  const manualStatusByInstallment = new Map(
    debt.installmentStatuses.map((item) => [item.installment, item.status])
  );

  let projectedBalance = initialAmount;
  let paidCapital = 0;
  let installment = 1;

  while (projectedBalance > 0.01 && installment <= 480) {
    const interest = Math.max(projectedBalance * monthlyRate, 0);
    const capital = Math.min(
      Math.max(monthlyPayment - interest, 0),
      projectedBalance
    );
    const payment = capital + interest;
    const paid = paidByInstallment.get(installment) ?? 0;
    const calculatedStatus =
      paid >= Math.min(monthlyPayment, payment) || projectedBalance <= 0
        ? "PAGADO"
        : "PENDIENTE";
    const status =
      manualStatusByInstallment.get(installment) ?? calculatedStatus;

    if (status === "PAGADO") paidCapital += capital;
    projectedBalance = Math.max(projectedBalance - capital, 0);

    if (capital <= 0) break;
    installment += 1;
  }

  return Math.max(initialAmount - paidCapital, 0);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const installment = Number(body.installment);
    const status = mapStatusToDB(body.status);

    if (!Number.isInteger(installment) || installment <= 0) {
      throw new Error("La cuota no es valida.");
    }

    const user = await getOrCreateUser(session);
    const debt = await prisma.debt.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!debt) {
      throw new Error("El prestamo no existe o no pertenece al usuario.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const override = await tx.debtInstallmentStatus.upsert({
        where: {
          userId_debtId_installment: {
            userId: user.id,
            debtId: debt.id,
            installment,
          },
        },
        update: { status },
        create: {
          userId: user.id,
          debtId: debt.id,
          installment,
          status,
        },
      });

      const debtWithRows = await tx.debt.findUniqueOrThrow({
        where: { id: debt.id },
        include: {
          payments: {
            select: {
              amount: true,
              paymentStatus: true,
              type: true,
              debtInstallment: true,
            },
          },
          installmentStatuses: {
            select: {
              installment: true,
              status: true,
            },
          },
        },
      });

      const currentBalance = recalculateCurrentBalance(debtWithRows);
      await tx.debt.update({
        where: { id: debt.id },
        data: { currentBalance },
      });

      return { override, currentBalance };
    });

    return NextResponse.json({
      ok: true,
      data: {
        installment: result.override.installment,
        status: result.override.status === "PAGADO" ? "Pagado" : "Pendiente",
        currentBalance: result.currentBalance,
      },
    });
  } catch (error) {
    console.error("API /debts/[id]/installment-status PATCH error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 400 }
    );
  }
}
