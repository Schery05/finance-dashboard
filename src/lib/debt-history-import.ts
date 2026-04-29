export type ParsedDebtHistoryPayment = {
  date: string;
  description: string;
  amount: number;
  status: "Pagado" | "Pendiente";
  installment: number;
};

function normalizeText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseAmount(value: string) {
  const negative = /[-−]/.test(value);
  const cleaned = value.replace(/[^\d.,]/g, "").replace(/,/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? Math.abs(amount) * (negative ? -1 : 1) : 0;
}

function parseDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function cleanDescription(lines: string[]) {
  return lines
    .filter((line) => {
      const normalized = normalizeText(line);
      return (
        line.trim() &&
        !/^gasto$|^ingre$|^so$|^ingreso$/.test(normalized) &&
        !/^pagado$|^pendien$|^te$|^pendiente$/.test(normalized) &&
        !/^rd\$/.test(normalized) &&
        !/^[+−-]?rd\$/.test(normalized)
      );
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDebtHistoryPaymentsFromText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const dateIndexes = lines
    .map((line, index) => (/^\d{2}\/\d{2}\/\d{4}$/.test(line) ? index : -1))
    .filter((index) => index >= 0);
  const rows: ParsedDebtHistoryPayment[] = [];

  for (let i = 0; i < dateIndexes.length; i += 1) {
    const start = dateIndexes[i];
    const end = dateIndexes[i + 1] ?? lines.length;
    const block = lines.slice(start, end);
    const amountLine = [...block].reverse().find((line) => /[+−-]?RD\$/i.test(line));
    if (!amountLine) continue;

    const amount = parseAmount(amountLine);
    if (!amount) continue;

    const normalizedBlock = normalizeText(block.join(" "));
    const status = /pendien\s*te|pendiente/.test(normalizedBlock)
      ? "Pendiente"
      : "Pagado";
    const isExpense =
      /gasto/.test(normalizedBlock) || amount < 0 || !/ingre\s*so|ingreso/.test(normalizedBlock);

    if (!isExpense) continue;

    rows.push({
      date: parseDate(block[0]),
      description: cleanDescription(block.slice(1, -1)) || "Pago prestamo",
      amount: Math.abs(amount),
      status,
      installment: rows.length + 1,
    });
  }

  return rows.filter((row) => row.date && row.amount > 0);
}
