import type { ParsedBankTransaction } from "@/lib/bank-import-parser";
import { normalizeBankImportText } from "@/lib/bank-import-parser";
import type { TransactionInput } from "@/lib/validators";

export type BankCategoryRuleInput = {
  pattern: string;
  categoryName: string;
  transactionType: "INGRESO" | "GASTO";
};

export type BankCategoryOverride = {
  pattern: string;
  category: string;
};

export function getBankImportPattern(description: string) {
  return normalizeBankImportText(description).replace(/\s+/g, " ").trim();
}

export function applyUserBankCategoryRules(
  rows: ParsedBankTransaction[],
  rules: BankCategoryRuleInput[]
): ParsedBankTransaction[] {
  const rulesByPattern = new Map(
    rules.map((rule) => [rule.pattern, rule])
  );

  return rows.map((row) => {
    const rule = rulesByPattern.get(getBankImportPattern(row.sourceRawDescription));
    if (!rule) return row;

    return {
      ...row,
      Tipo: rule.transactionType === "INGRESO" ? "Ingreso" : "Gasto",
      Categoría: rule.categoryName,
    };
  });
}

export function applyBankCategoryOverrides<T extends TransactionInput & { sourceRawDescription?: string }>(
  rows: T[],
  overrides: BankCategoryOverride[]
): T[] {
  const overridesByPattern = new Map(
    overrides
      .map((override) => ({
        pattern: getBankImportPattern(override.pattern),
        category: override.category.trim(),
      }))
      .filter((override) => override.pattern && override.category)
      .map((override) => [override.pattern, override.category])
  );

  return rows.map((row) => {
    const pattern = getBankImportPattern(row.sourceRawDescription ?? "");
    const category = overridesByPattern.get(pattern);
    return category ? { ...row, Categoría: category } : row;
  });
}

export function normalizeBankCategoryOverrides(
  overrides: unknown
): BankCategoryOverride[] {
  if (!Array.isArray(overrides)) return [];

  return overrides
    .map((override) => {
      if (!override || typeof override !== "object") return null;
      const item = override as Record<string, unknown>;
      const pattern = String(item.pattern ?? "").trim();
      const category = String(item.category ?? "").trim();
      if (!pattern || !category) return null;
      return { pattern, category };
    })
    .filter((override): override is BankCategoryOverride => Boolean(override));
}
