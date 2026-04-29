import {
  inferBankTransactionCategory,
  normalizeBankImportText,
  type ParsedBankTransaction,
} from "@/lib/bank-import-parser";
import { extractJpegImagesFromPdf, extractTextFromPdf } from "@/lib/pdf-text";

type OcrTransaction = {
  date?: string;
  description?: string;
  amount?: number | string;
  reference?: string;
  type?: "Ingreso" | "Gasto";
};

const SPANISH_MONTHS = new Map([
  ["ene", 1],
  ["enero", 1],
  ["feb", 2],
  ["febrero", 2],
  ["mar", 3],
  ["marzo", 3],
  ["abr", 4],
  ["abril", 4],
  ["may", 5],
  ["mayo", 5],
  ["jun", 6],
  ["junio", 6],
  ["jul", 7],
  ["julio", 7],
  ["ago", 8],
  ["agosto", 8],
  ["sept", 9],
  ["sep", 9],
  ["septiembre", 9],
  ["oct", 10],
  ["octubre", 10],
  ["nov", 11],
  ["noviembre", 11],
  ["dic", 12],
  ["diciembre", 12],
]);

function parseAmount(value: number | string | undefined) {
  if (typeof value === "number") return Math.abs(value);

  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/[^\d.,-]/g, "");
  const decimalMatch = cleaned.match(/(\d+)[,.](\d{2})$/);
  const normalized = decimalMatch
    ? cleaned.replace(/[,.](?=\d{3}(\D|$))/g, "").replace(",", ".")
    : cleaned.replace(/[^\d-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function parseSignedAmount(value: string) {
  const sign = /-\s*[\dR]/i.test(value) || /RD\$\s*-/.test(value) ? -1 : 1;
  return parseAmount(value) * sign;
}

function normalizeDate(value: string | undefined) {
  const raw = String(value ?? "").trim();
  const iso = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (!dmy) return "";

  const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
  return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
}

function inferStatementDate(text: string) {
  const normalized = normalizeBankImportText(text);
  const match = normalized.match(
    /(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})|(\d{1,2})\s+([a-z]+)\s+(\d{4})/
  );
  if (!match) return new Date();

  const monthName = match[2] ?? match[5];
  const year = Number(match[3] ?? match[6]);
  const month = SPANISH_MONTHS.get(monthName) ?? new Date().getMonth() + 1;
  return new Date(year, month - 1, 1);
}

function parseStatementDate(value: string, statementDate: Date) {
  const match = String(value ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return normalizeDate(value);

  const day = Number(match[1]);
  const month = Number(match[2]);
  const statementMonth = statementDate.getMonth() + 1;
  const year = month > statementMonth ? statementDate.getFullYear() - 1 : statementDate.getFullYear();

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function cleanPdfText(value: string) {
  return String(value ?? "")
    .replace(/\be\b/g, "C")
    .replace(/\be(?=[A-Z])/g, "C")
    .replace(/([A-Z])e(?=\s|[A-Z]|$)/g, "$1C")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldIgnorePdfRow(description: string, category: string) {
  const text = normalizeBankImportText(description);
  return (
    normalizeBankImportText(category) === "pago tarjeta" ||
    /^pago\s+via\s+app|^pago\s+via\s+cel/.test(text)
  );
}

function parseTextRows(text: string, sourceBank: string) {
  const statementDate = inferStatementDate(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows: ParsedBankTransaction[] = [];

  for (let index = 0; index < lines.length - 3; index += 1) {
    if (!/^\d{1,2}\/\d{1,2}$/.test(lines[index])) continue;
    if (!/^\d{1,2}\/\d{1,2}$/.test(lines[index + 1])) continue;

    const amountIndex = lines
      .slice(index + 2, index + 8)
      .findIndex((line) => /^RD\$\s*-?[\d,.]+$/i.test(line));
    if (amountIndex < 0) continue;

    const absoluteAmountIndex = index + 2 + amountIndex;
    const detailLines = lines.slice(index + 2, absoluteAmountIndex);
    const reference = /^\d{3,}$/.test(detailLines[0] ?? "") ? detailLines[0] : "";
    const description = cleanPdfText((reference ? detailLines.slice(1) : detailLines).join(" "));
    const signedAmount = parseSignedAmount(lines[absoluteAmountIndex]);
    const amount = Math.abs(signedAmount);

    if (!description || amount <= 0) continue;

    const inferred = inferBankTransactionCategory(description, "", amount);
    if (shouldIgnorePdfRow(description, inferred.category)) {
      index = absoluteAmountIndex;
      continue;
    }

    const type = signedAmount < 0 && inferred.category !== "Pago tarjeta" ? "Ingreso" : inferred.type;
    const category =
      type === inferred.type ? inferred.category : type === "Ingreso" ? "Reembolsos" : inferred.category;

    rows.push({
      Fecha: parseStatementDate(lines[index + 1], statementDate),
      Tipo: type,
      Categoría: category,
      Importe: amount,
      EstadoPago: "Pagado",
      DescripcionAdicional: reference
        ? `${description} | Ref ${reference}`
        : description,
      EsPagoDeuda: false,
      sourceBank,
      sourceReference: reference,
      sourceRawDescription: description,
    });

    index = absoluteAmountIndex;
  }

  return rows;
}

function mapOcrRows(rows: OcrTransaction[], sourceBank: string) {
  return rows
    .map((row): ParsedBankTransaction | null => {
      const date = normalizeDate(row.date);
      const amount = parseAmount(row.amount);
      const description = String(row.description ?? "").trim();
      const reference = String(row.reference ?? "").trim();

      if (!date || amount <= 0 || !description) return null;

      const inferred = inferBankTransactionCategory(description, "", amount);
      const type = row.type === "Ingreso" || row.type === "Gasto" ? row.type : inferred.type;
      const category =
        type === inferred.type ? inferred.category : type === "Ingreso" ? "Bonos" : inferred.category;

      if (normalizeBankImportText(category) === "pago tarjeta") return null;

      return {
        Fecha: date,
        Tipo: type,
        Categoría: category,
        Importe: amount,
        EstadoPago: "Pagado",
        DescripcionAdicional: reference
          ? `${description} | Ref ${reference}`
          : description,
        EsPagoDeuda: false,
        sourceBank,
        sourceReference: reference,
        sourceRawDescription: description,
      };
    })
    .filter((row): row is ParsedBankTransaction => Boolean(row));
}

async function extractRowsWithOpenAI(images: Buffer[], sourceBank: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Este PDF parece ser una imagen escaneada. Configura OPENAI_API_KEY para habilitar OCR con IA o sube el CSV del banco."
    );
  }

  const imageContent = images.slice(0, 6).map((image) => ({
    type: "input_image",
    image_url: `data:image/jpeg;base64,${image.toString("base64")}`,
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMPORT_MODEL ?? "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Extrae solo las transacciones visibles de este estado bancario o tarjeta en PDF. " +
                "Devuelve exclusivamente JSON con la forma {\"transactions\": [...]}. Cada item debe tener: date en YYYY-MM-DD, description, amount positivo, reference opcional y type como Ingreso o Gasto. " +
                "Ignora balances, limites, totales, pagos minimos, encabezados y filas que no sean movimientos.",
            },
            ...imageContent,
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "bank_pdf_transactions",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              transactions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    date: { type: "string" },
                    description: { type: "string" },
                    amount: { type: "number" },
                    reference: { type: "string" },
                    type: { type: "string", enum: ["Ingreso", "Gasto"] },
                  },
                  required: ["date", "description", "amount", "reference", "type"],
                },
              },
            },
            required: ["transactions"],
          },
        },
      },
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error?.message ?? "No se pudo leer el PDF con OCR.");
  }

  const outputText =
    json.output_text ??
    json.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? [])
      ?.map((content: { text?: string }) => content.text ?? "")
      ?.join("") ??
    "{\"transactions\":[]}";
  const parsed = JSON.parse(outputText) as { transactions?: OcrTransaction[] };
  return mapOcrRows(parsed.transactions ?? [], sourceBank);
}

export async function parseBankTransactionsPDF(buffer: Buffer, sourceBank = "PDF bancario") {
  const text = extractTextFromPdf(buffer);
  const textRows = parseTextRows(text, sourceBank);
  if (textRows.length > 0) return textRows;

  const images = extractJpegImagesFromPdf(buffer);
  if (images.length === 0) {
    throw new Error("No se encontraron transacciones legibles en este PDF.");
  }

  return extractRowsWithOpenAI(images, sourceBank);
}
