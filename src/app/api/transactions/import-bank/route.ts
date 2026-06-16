import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getOrCreateUser } from "@/lib/auth-user";
import {
  applyBankCategoryOverrides,
  applyUserBankCategoryRules,
  getBankImportPattern,
  normalizeBankCategoryOverrides,
} from "@/lib/bank-category-rules";
import { parseBankTransactionsPDF } from "@/lib/bank-import-pdf-parser";
import { parseBankTransactionsCSV } from "@/lib/bank-import-parser";
import { mapUIToDB } from "@/lib/mappers/transaction.mapper";
import { prisma } from "@/lib/prisma";
import { TransactionSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

function getImportRowKey(row: {
  Fecha: string;
  Tipo: string;
  Importe: number;
  DescripcionAdicional?: string;
  sourceRawDescription?: string;
  sourceReference?: string;
  sourceImportKey?: string;
}) {
  if (row.sourceImportKey) return row.sourceImportKey;

  return [
    row.Fecha,
    row.Tipo,
    Number(row.Importe) || 0,
    row.sourceRawDescription || row.DescripcionAdicional || "",
    row.sourceReference || "",
  ].join("|");
}

function normalizeImportKeyPart(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .toLowerCase();
}

function getDuplicateRowKey(row: {
  Fecha: string;
  Tipo: string;
  Importe: number;
  DescripcionAdicional?: string;
  sourceRawDescription?: string;
  sourceReference?: string;
}) {
  const amount = (Number(row.Importe) || 0).toFixed(2);
  const reference = normalizeImportKeyPart(row.sourceReference ?? "");

  if (reference) {
    return [row.Fecha, row.Tipo, amount, reference].join("|");
  }

  const description = normalizeImportKeyPart(
    row.sourceRawDescription || row.DescripcionAdicional || ""
  );
  return [row.Fecha, row.Tipo, amount, description].join("|");
}

function dedupeImportRows<T extends {
  Fecha: string;
  Tipo: string;
  Importe: number;
  DescripcionAdicional?: string;
  sourceRawDescription?: string;
  sourceReference?: string;
}>(rows: T[]) {
  const seen = new Set<string>();
  const unique: Array<T & { sourceImportKey: string }> = [];
  let duplicateCount = 0;

  for (const row of rows) {
    const sourceImportKey = getDuplicateRowKey(row);
    if (seen.has(sourceImportKey)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(sourceImportKey);
    unique.push({ ...row, sourceImportKey });
  }

  return { rows: unique, duplicateCount };
}

function normalizeRowEdits(value: unknown) {
  if (!Array.isArray(value)) {
    return new Map<
      string,
      { type?: "Ingreso" | "Gasto"; category?: string; description?: string }
    >();
  }

  const edits = new Map<
    string,
    { type?: "Ingreso" | "Gasto"; category?: string; description?: string }
  >();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const row = item as {
      key?: unknown;
      type?: unknown;
      category?: unknown;
      description?: unknown;
    };
    if (typeof row.key !== "string" || !row.key.trim()) continue;

    const type = row.type === "Ingreso" || row.type === "Gasto" ? row.type : undefined;
    const category = typeof row.category === "string" && row.category.trim()
      ? row.category.trim()
      : undefined;
    const description =
      typeof row.description === "string" ? row.description.trim() : undefined;

    if (!type && !category && description === undefined) continue;
    edits.set(row.key, { type, category, description });
  }

  return edits;
}

async function findUserBankCategoryRules(userId: string) {
  const client = prisma as typeof prisma & {
    bankCategoryRule?: {
      findMany: typeof prisma.bankCategoryRule.findMany;
    };
  };

  if (!client.bankCategoryRule) return [];

  return client.bankCategoryRule.findMany({
    where: { userId },
    select: {
      pattern: true,
      categoryName: true,
      transactionType: true,
    },
  });
}

async function upsertUserBankCategoryRule({
  userId,
  pattern,
  categoryName,
  transactionType,
}: {
  userId: string;
  pattern: string;
  categoryName: string;
  transactionType: "INGRESO" | "GASTO";
}) {
  const client = prisma as typeof prisma & {
    bankCategoryRule?: {
      upsert: typeof prisma.bankCategoryRule.upsert;
    };
  };

  if (!client.bankCategoryRule) return;

  await client.bankCategoryRule.upsert({
    where: {
      userId_pattern: {
        userId,
        pattern,
      },
    },
    update: {
      categoryName,
      transactionType,
    },
    create: {
      userId,
      pattern,
      categoryName,
      transactionType,
    },
  });
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

    const form = await req.formData();
    const mode = String(form.get("mode") ?? "preview");
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new Error("Selecciona un archivo CSV o PDF para importar.");
    }

    const user = await getOrCreateUser(session);
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const parsedFileRows = isPdf
      ? await parseBankTransactionsPDF(Buffer.from(await file.arrayBuffer()), file.name)
      : parseBankTransactionsCSV(await file.text(), file.name);
    const overridesRaw = String(form.get("overrides") ?? "[]");
    const overrides = normalizeBankCategoryOverrides(JSON.parse(overridesRaw));
    const excludedRowKeys = new Set(
      (JSON.parse(String(form.get("excludedRows") ?? "[]")) as unknown[])
        .filter((key): key is string => typeof key === "string")
    );
    const rowEdits = normalizeRowEdits(
      JSON.parse(String(form.get("rowEdits") ?? "[]"))
    );
    const userRules = await findUserBankCategoryRules(user.id);
    const categorizedRows = applyBankCategoryOverrides(
      applyUserBankCategoryRules(
        parsedFileRows,
        userRules
      ),
      overrides
    );
    const keyedRows = categorizedRows.map((row) => ({
      ...row,
      sourceImportKey: getDuplicateRowKey(row),
    }));
    const { rows: dedupedRows, duplicateCount } = dedupeImportRows(keyedRows);
    const parsedRows = dedupedRows
      .filter((row) => !excludedRowKeys.has(getImportRowKey(row)))
      .map((row) => {
        const edit = rowEdits.get(getImportRowKey(row));
        if (!edit) return row;

        return {
          ...row,
          Tipo: edit.type ?? row.Tipo,
          Categoría: edit.category ?? row.Categoría,
          DescripcionAdicional:
            edit.description !== undefined ? edit.description : row.DescripcionAdicional,
        };
      })
      .map((row) => ({
        ...row,
        ...TransactionSchema.parse(row),
      }));

    if (mode !== "import") {
      return NextResponse.json({
        ok: true,
        data: {
          rows: parsedRows,
          total: parsedRows.length,
          duplicateCount,
        },
      });
    }

    const mappedRows = parsedRows.map((row) => ({
      row,
      mapped: mapUIToDB(row),
    }));
    const categoryByKey = new Map<string, { id: string }>();
    let created = 0;
    let skipped = duplicateCount;

    for (const { mapped } of mappedRows) {
      const key = `${mapped.type}:${mapped.categoryName}`;
      if (categoryByKey.has(key)) continue;

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
        select: {
          id: true,
        },
      });
      categoryByKey.set(key, category);
    }

    for (const { row, mapped } of mappedRows) {
      const sourceReference = String(row.sourceReference ?? "").trim();
      const existing = await prisma.transaction.findFirst({
        where: {
          userId: user.id,
          date: mapped.date,
          type: mapped.type,
          amount: mapped.amount,
          ...(sourceReference
            ? { additionalDescription: { contains: sourceReference } }
            : { additionalDescription: mapped.additionalDescription }),
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      const category = categoryByKey.get(`${mapped.type}:${mapped.categoryName}`);
      if (!category) throw new Error("No se pudo preparar la categoria.");

      await prisma.transaction.create({
        data: {
          date: mapped.date,
          type: mapped.type,
          amount: mapped.amount,
          paymentStatus: mapped.paymentStatus,
          additionalDescription: mapped.additionalDescription,
          userId: user.id,
          categoryId: category.id,
        },
      });
      created += 1;
    }

    for (const override of overrides) {
      const pattern = getBankImportPattern(override.pattern);
      const matchingRow = parsedRows.find(
        (row) => getBankImportPattern(row.sourceRawDescription) === pattern
      );
      if (!pattern || !matchingRow) continue;

      await upsertUserBankCategoryRule({
        userId: user.id,
        pattern,
        categoryName: override.category,
        transactionType: matchingRow.Tipo === "Ingreso" ? "INGRESO" : "GASTO",
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        created,
        skipped,
        total: parsedRows.length,
      },
    });
  } catch (error) {
    console.error("API /transactions/import-bank POST error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 400 }
    );
  }
}
