import { google } from "googleapis";
import type { Budget } from "./budgets";
import type { SavingsGoal, Transaction } from "./types";
import { TransactionInput } from "./validators";

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const RANGE = process.env.GOOGLE_SHEETS_RANGE || "Transacciones!A:G";
const SAVINGS_GOALS_RANGE =
  process.env.GOOGLE_SAVINGS_GOALS_RANGE || "MetasAhorro!A2:G";
const BUDGETS_RANGE = process.env.GOOGLE_BUDGETS_RANGE || "Presupuesto!A2:E";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  //const key = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const raw = process.env.GOOGLE_PRIVATE_KEY;
  if (!raw) throw new Error("Missing GOOGLE_PRIVATE_KEY in env");

  const key = raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .trim();

  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function parseAmount(v: unknown): number {
  let s = String(v ?? "").trim();

  if (!s) return 0;

  // Quita símbolos y letras comunes
  s = s.replace(/rd\$|dop|usd|\$/gi, "").trim();

  // Quita espacios internos
  s = s.replace(/\s+/g, "");

  // Si viene formato "1.234,56" (punto miles, coma decimal) => 1234.56
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Asumimos que el último separador es el decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // 1.234,56
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // Puede ser "1234,56" (coma decimal) o "1,234" (miles)
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = s.replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else {
    // solo punto o nada: "1234.56" o "1.234"
    // si parece miles (1.234) y no hay decimales claros, lo dejamos como miles quitando puntos
    const parts = s.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      s = s.replace(/\./g, "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function getSheetName(range: string) {
  return range.split("!")[0].replace(/"/g, "");
}

function parseAssociatedTransactions(v: unknown) {
  const raw = String(v ?? "").trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // Support older comma-separated values too.
  }

  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function readTransactions(): Promise<TransactionInput[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  });

  const rows = res.data.values ?? [];
  // Si tu sheet tiene headers en la primera fila, descomenta esto:
  // const dataRows = rows.slice(1);
  const dataRows = rows;

  return dataRows
    .filter((r) => r.length >= 6) // necesitamos al menos ID..EstadoPago
    .map((r) => ({
      ID: String(r[0] ?? "").trim(),
      Fecha: String(r[1] ?? ""),
      Tipo: String(r[2] ?? "").trim() as any,  // "Ingreso" | "Gasto"
      Categoría: String(r[3] ?? "").trim() || "General",
      Importe: parseAmount(r[4]),
      EstadoPago: (r[5] ?? "Pendiente") as any, // "Pagado" | "Pendiente"
      DescripcionAdicional: String(r[6] ?? ""),
      EsPagoDeuda: false,
    }))
    .filter((t) => t.ID); // evita filas s
}

export async function appendTransaction(tx: Transaction): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        tx.ID,
        tx.Fecha,
        tx.Tipo,
        tx.Categoría,
        tx.Importe,
        tx.EstadoPago,
        tx.DescripcionAdicional ?? "",
      ]],
    },
  });
}

//ACTUALIZACION DE TRANSACCIONES SEGUN SU ID
export async function updateTransactionById(id: string, tx: Omit<Transaction, "ID">) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const sheetName = getSheetName(RANGE); // "Hoja 1"
  // Leemos todas las filas para encontrar el ID (simple y efectivo)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:A`,
  });

  const colA = res.data.values ?? []; // cada item es ["ID"]
  const rowIndex = colA.findIndex((r) => String(r?.[0] ?? "").trim() === id);

  if (rowIndex === -1) throw new Error(`No se encontró la transacción con ID=${id}`);

  // rowIndex es 0-based sobre la columna A (incluye headers en fila 1 si pediste A:A)
  // Si tienes headers en fila 1, entonces rowNumber real = rowIndex + 1
  const rowNumber = rowIndex + 1;

  const updateRange = `${sheetName}!A${rowNumber}:G${rowNumber}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: updateRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        id,
        tx.Fecha,
        tx.Tipo,
        tx.Categoría,
        tx.Importe,
        tx.EstadoPago,
        tx.DescripcionAdicional ?? "",
      ]],
    },
  });
}

export async function readSavingsGoals(): Promise<SavingsGoal[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SAVINGS_GOALS_RANGE,
  });

  const rows = res.data.values ?? [];

  return rows
    .filter((r) => r.length >= 3)
    .map((r) => ({
      ID: String(r[0] ?? "").trim(),
      Nombre: String(r[1] ?? "").trim(),
      MontoObjetivo: parseAmount(r[2]),
      FechaLimite: String(r[3] ?? "").trim(),
      TransaccionesAsociadas: parseAssociatedTransactions(r[4]),
      CreadoEn: String(r[5] ?? "").trim(),
      SaldoInicial: parseAmount(r[6]),
    }))
    .filter((goal) => goal.ID && goal.Nombre);
}

export async function appendSavingsGoal(goal: SavingsGoal): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: SAVINGS_GOALS_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        goal.ID,
        goal.Nombre,
        goal.MontoObjetivo,
        goal.FechaLimite,
        JSON.stringify(goal.TransaccionesAsociadas),
        goal.CreadoEn,
        goal.SaldoInicial,
      ]],
    },
  });
}

export async function updateSavingsGoalById(
  id: string,
  goal: Omit<SavingsGoal, "ID">
) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetName = getSheetName(SAVINGS_GOALS_RANGE);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:A`,
  });

  const colA = res.data.values ?? [];
  const rowIndex = colA.findIndex((r) => String(r?.[0] ?? "").trim() === id);
  if (rowIndex === -1) throw new Error(`No se encontro la meta con ID=${id}`);

  const rowNumber = rowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A${rowNumber}:G${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        id,
        goal.Nombre,
        goal.MontoObjetivo,
        goal.FechaLimite,
        JSON.stringify(goal.TransaccionesAsociadas),
        goal.CreadoEn,
        goal.SaldoInicial,
      ]],
    },
  });
}

export async function deleteSavingsGoalById(id: string) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetName = getSheetName(SAVINGS_GOALS_RANGE);

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });
  const sheet = spreadsheet.data.sheets?.find(
    (item) => item.properties?.title === sheetName
  );
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) {
    throw new Error(`No se encontro la hoja ${sheetName}`);
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:A`,
  });

  const colA = res.data.values ?? [];
  const rowIndex = colA.findIndex((r) => String(r?.[0] ?? "").trim() === id);
  if (rowIndex === -1) throw new Error(`No se encontro la meta con ID=${id}`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}

export async function readBudgets(): Promise<Budget[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: BUDGETS_RANGE,
  });

  const rows = res.data.values ?? [];

  return rows
    .filter((r) => r.length >= 4)
    .map((r) => ({
      id: String(r[0] ?? "").trim(),
      category: String(r[1] ?? "").trim(),
      monthlyLimit: parseAmount(r[2]),
      period: String(r[3] ?? "").trim(),
      createdAt: String(r[4] ?? "").trim(),
    }))
    .filter((budget) => budget.id && budget.category && budget.period);
}

export async function appendBudget(budget: Budget): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: BUDGETS_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        budget.id,
        budget.category,
        budget.monthlyLimit,
        budget.period,
        budget.createdAt,
      ]],
    },
  });
}

export async function updateBudgetById(id: string, budget: Omit<Budget, "id">) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetName = getSheetName(BUDGETS_RANGE);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:A`,
  });

  const colA = res.data.values ?? [];
  const rowIndex = colA.findIndex((r) => String(r?.[0] ?? "").trim() === id);
  if (rowIndex === -1) {
    throw new Error(`No se encontro el presupuesto con ID=${id}`);
  }

  const rowNumber = rowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A${rowNumber}:E${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        id,
        budget.category,
        budget.monthlyLimit,
        budget.period,
        budget.createdAt,
      ]],
    },
  });
}

export async function deleteBudgetById(id: string) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetName = getSheetName(BUDGETS_RANGE);

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });
  const sheet = spreadsheet.data.sheets?.find(
    (item) => item.properties?.title === sheetName
  );
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) {
    throw new Error(`No se encontro la hoja ${sheetName}`);
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:A`,
  });

  const colA = res.data.values ?? [];
  const rowIndex = colA.findIndex((r) => String(r?.[0] ?? "").trim() === id);
  if (rowIndex === -1) {
    throw new Error(`No se encontro el presupuesto con ID=${id}`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}
