import { config } from "dotenv";
import { google } from "googleapis";

config({ path: ".env" });
config({ path: ".env.local", override: true });

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  if (!email || !rawKey || !spreadsheetId) {
    throw new Error("Faltan variables de Google Sheets.");
  }

  return {
    spreadsheetId,
    auth: new google.auth.JWT({
      email,
      key: rawKey.replace(/\\n/g, "\n").replace(/\\r/g, "").trim(),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    }),
  };
}

async function main() {
  const { auth, spreadsheetId } = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const titles =
    spreadsheet.data.sheets
      ?.map((sheet) => sheet.properties?.title)
      .filter(Boolean) ?? [];

  console.log("Hojas encontradas:");
  for (const title of titles) console.log(`- ${title}`);

  const ranges = [
    process.env.GOOGLE_SAVINGS_GOALS_RANGE || "MetasAhorro!A2:G",
    "MetasAhorro!A:G",
    "Metas de ahorro!A:G",
    "Ahorros!A:G",
    "Metas!A:G",
  ];

  for (const range of ranges) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      const rows = res.data.values ?? [];
      console.log(`\n${range}: ${rows.length} fila(s)`);
      console.log(rows.slice(0, 3));
    } catch (error) {
      console.log(`\n${range}: no disponible`);
      if (error instanceof Error) console.log(error.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
