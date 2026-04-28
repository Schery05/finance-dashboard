import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { google } from "googleapis";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no esta configurada.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const USER_EMAIL =
  process.env.MIGRATION_USER_EMAIL ?? "yamilet.schery05@gmail.com";
const USER_NAME = process.env.MIGRATION_USER_NAME ?? "Yamilet";

type TransactionRow = {
  ID?: string;
  Fecha?: string;
  Tipo?: string;
  Categoria?: string;
  Categoría?: string;
  Importe?: string;
  EstadoPago?: string;
  DescripcionAdicional?: string;
};

type MigrationStats = {
  transactionsCreated: number;
  transactionsUpdated: number;
  transactionsSkipped: number;
  budgetsCreated: number;
  budgetsUpdated: number;
  budgetsSkipped: number;
  goalsCreated: number;
  goalsUpdated: number;
  goalsSkipped: number;
  movementsCreated: number;
  movementsUpdated: number;
  missingGoalTransactions: number;
};

type TransactionType = "INGRESO" | "GASTO";
type PaymentStatus = "PAGADO" | "PENDIENTE";
type SavingsMovementType = "APORTE" | "RETIRO" | "AJUSTE";

function normalizeTransactionType(value?: string): TransactionType {
  return String(value ?? "").trim().toUpperCase() === "INGRESO"
    ? "INGRESO"
    : "GASTO";
}

function normalizePaymentStatus(value?: string): PaymentStatus {
  return String(value ?? "").trim().toUpperCase() === "PAGADO"
    ? "PAGADO"
    : "PENDIENTE";
}

function normalizeSavingsMovementType(value?: string): SavingsMovementType {
  const clean = String(value ?? "").trim().toUpperCase();
  if (clean === "RETIRO") return "RETIRO";
  if (clean === "AJUSTE") return "AJUSTE";
  return "APORTE";
}

function parseAmount(value: unknown): number {
  let raw = String(value ?? "").trim();
  if (!raw) return 0;

  raw = raw.replace(/rd\$|dop|usd|\$/gi, "").replace(/\s+/g, "");

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    raw =
      raw.lastIndexOf(",") > raw.lastIndexOf(".")
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
  } else if (hasComma) {
    const parts = raw.split(",");
    raw = parts.length === 2 && parts[1].length <= 2
      ? raw.replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (hasDot) {
    const parts = raw.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      raw = raw.replace(/\./g, "");
    }
  }

  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : 0;
}

function parseDate(value: unknown): Date | null {
  const clean = String(value ?? "").trim();
  if (!clean) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date(`${clean}T00:00:00.000Z`);
  }

  const dmy = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    return new Date(`${dmy[3]}-${month}-${day}T00:00:00.000Z`);
  }

  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePeriod(value: string) {
  const clean = String(value ?? "").trim();
  const match = clean.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || !month || month < 1 || month > 12) return null;

  return { year, month };
}

function parseAssociatedTransactions(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(String).map((id) => id.trim()).filter(Boolean);
    }
  } catch {
    // Older sheets may use comma-separated transaction IDs.
  }

  return raw.split(",").map((id) => id.trim()).filter(Boolean);
}

function getCell(row: unknown[], index: number) {
  return String(row[index] ?? "").trim();
}

function getGoogleAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey || !process.env.GOOGLE_SHEETS_ID) return null;

  return new google.auth.JWT({
    email,
    key: rawKey.replace(/\\n/g, "\n").replace(/\\r/g, "").trim(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

async function getUser() {
  return prisma.user.upsert({
    where: { email: USER_EMAIL },
    update: { name: USER_NAME },
    create: { email: USER_EMAIL, name: USER_NAME },
  });
}

async function upsertCategory(
  userId: string,
  name: string,
  type: TransactionType
) {
  return prisma.category.upsert({
    where: {
      userId_name_type: {
        userId,
        name,
        type,
      },
    },
    update: {
      isActive: true,
    },
    create: {
      userId,
      name,
      type,
    },
  });
}

async function migrateTransactionsFromCsv(
  userId: string,
  stats: MigrationStats
) {
  const csvPath = path.join(process.cwd(), "data", "finance.csv");
  if (!fs.existsSync(csvPath)) {
    console.log("No encontre data/finance.csv, omitiendo transacciones CSV.");
    return;
  }

  const rows: TransactionRow[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(
        csv({
          separator: ";",
          mapHeaders: ({ header }) => header.trim(),
        })
      )
      .on("data", (data) => rows.push(data))
      .on("end", resolve)
      .on("error", reject);
  });

  for (const row of rows) {
    const id = String(row.ID ?? "").trim();
    const date = parseDate(row.Fecha);
    const categoryName = String(row.Categoria ?? row.Categoría ?? "").trim();
    const amount = parseAmount(row.Importe);
    const type = normalizeTransactionType(row.Tipo);

    if (!id || !date || !categoryName || amount <= 0) {
      stats.transactionsSkipped += 1;
      continue;
    }

    const category = await upsertCategory(userId, categoryName, type);
    const existing = await prisma.transaction.findUnique({ where: { id } });

    await prisma.transaction.upsert({
      where: { id },
      update: {
        userId,
        date,
        type,
        categoryId: category.id,
        amount,
        paymentStatus: normalizePaymentStatus(row.EstadoPago),
        additionalDescription: row.DescripcionAdicional?.trim() || null,
      },
      create: {
        id,
        userId,
        date,
        type,
        categoryId: category.id,
        amount,
        paymentStatus: normalizePaymentStatus(row.EstadoPago),
        additionalDescription: row.DescripcionAdicional?.trim() || null,
      },
    });

    if (existing) stats.transactionsUpdated += 1;
    else stats.transactionsCreated += 1;
  }
}

async function readSheetRange(range: string) {
  const auth = getGoogleAuth();
  if (!auth) return [];

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range,
  });

  return res.data.values ?? [];
}

async function migrateBudgetsFromSheets(userId: string, stats: MigrationStats) {
  const range = process.env.GOOGLE_BUDGETS_RANGE || "Presupuesto!A2:E";
  const rows = await readSheetRange(range);
  if (rows.length === 0) return;

  for (const row of rows) {
    const id = getCell(row, 0);
    const categoryName = getCell(row, 1);
    const monthlyLimit = parseAmount(row[2]);
    const period = parsePeriod(getCell(row, 3));
    const createdAt = parseDate(row[4]) ?? new Date();

    if (!id || !categoryName || monthlyLimit <= 0 || !period) {
      stats.budgetsSkipped += 1;
      continue;
    }

    const category = await upsertCategory(
      userId,
      categoryName,
      "GASTO"
    );

    const existing = await prisma.budget.findUnique({
      where: {
        userId_categoryId_month_year: {
          userId,
          categoryId: category.id,
          month: period.month,
          year: period.year,
        },
      },
    });

    if (existing) {
      await prisma.budget.update({
        where: { id: existing.id },
        data: {
          limit: monthlyLimit,
          createdAt,
        },
      });
      stats.budgetsUpdated += 1;
      continue;
    }

    await prisma.budget.create({
      data: {
        id,
        userId,
        categoryId: category.id,
        month: period.month,
        year: period.year,
        limit: monthlyLimit,
        createdAt,
      },
    });
    stats.budgetsCreated += 1;
  }
}

async function syncGoalTransactions(
  userId: string,
  goalId: string,
  transactionIds: string[],
  stats: MigrationStats
) {
  const uniqueIds = Array.from(new Set(transactionIds));

  await prisma.savingsMovement.deleteMany({
    where: {
      userId,
      goalId,
      transactionId: {
        notIn: uniqueIds,
      },
    },
  });

  for (const transactionId of uniqueIds) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!transaction) {
      stats.missingGoalTransactions += 1;
      continue;
    }

    const existing = await prisma.savingsMovement.findUnique({
      where: { transactionId },
    });

    await prisma.savingsMovement.upsert({
      where: { transactionId },
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

    if (existing) stats.movementsUpdated += 1;
    else stats.movementsCreated += 1;
  }
}

async function migrateSavingsGoalsFromSheets(
  userId: string,
  stats: MigrationStats
) {
  const range = process.env.GOOGLE_SAVINGS_GOALS_RANGE || "MetasAhorro!A2:G";
  const rows = await readSheetRange(range);
  if (rows.length === 0) return;

  for (const row of rows) {
    const id = getCell(row, 0);
    const name = getCell(row, 1);
    const target = parseAmount(row[2]);
    const deadline = parseDate(row[3]);
    const transactionIds = parseAssociatedTransactions(row[4]);
    const createdAt = parseDate(row[5]) ?? new Date();
    const initialBalance = parseAmount(row[6]);

    if (!id || !name || target <= 0) {
      stats.goalsSkipped += 1;
      continue;
    }

    const existing = await prisma.savingsGoal.findUnique({ where: { id } });

    await prisma.savingsGoal.upsert({
      where: { id },
      update: {
        userId,
        name,
        target,
        initialBalance,
        deadline,
        createdAt,
        isActive: true,
      },
      create: {
        id,
        userId,
        name,
        target,
        initialBalance,
        deadline,
        createdAt,
        isActive: true,
      },
    });

    if (existing) stats.goalsUpdated += 1;
    else stats.goalsCreated += 1;

    await syncGoalTransactions(userId, id, transactionIds, stats);
  }
}

async function main() {
  const stats: MigrationStats = {
    transactionsCreated: 0,
    transactionsUpdated: 0,
    transactionsSkipped: 0,
    budgetsCreated: 0,
    budgetsUpdated: 0,
    budgetsSkipped: 0,
    goalsCreated: 0,
    goalsUpdated: 0,
    goalsSkipped: 0,
    movementsCreated: 0,
    movementsUpdated: 0,
    missingGoalTransactions: 0,
  };

  const user = await getUser();
  console.log(`Migrando datos para ${user.email} (${user.id})`);

  await migrateTransactionsFromCsv(user.id, stats);
  await migrateBudgetsFromSheets(user.id, stats);
  await migrateSavingsGoalsFromSheets(user.id, stats);

  console.log("Resultado de migracion:");
  console.table(stats);
}

main()
  .catch((error) => {
    console.error("Error migrando data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
