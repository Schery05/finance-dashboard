import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getOrCreateUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import {
  normalizeSubscriptionFrequency,
  normalizeSubscriptionStatus,
  type Subscription,
  type SubscriptionInput,
} from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

async function getAuthenticatedUser() {
  const session = await getServerSession();
  if (!session) throw new Error("No autorizado");
  return getOrCreateUser(session);
}

type SubscriptionRow = {
  id: string;
  name: string;
  category: string;
  amount: string | number;
  currency: string;
  frequency: string;
  nextChargeDate: Date;
  autoRenew: boolean;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapRow(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    amount: Number(row.amount) || 0,
    currency: row.currency,
    frequency: normalizeSubscriptionFrequency(row.frequency),
    nextChargeDate: row.nextChargeDate.toISOString().slice(0, 10),
    autoRenew: Boolean(row.autoRenew),
    status: normalizeSubscriptionStatus(row.status),
    notes: row.notes ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseInput(body: Partial<SubscriptionInput>) {
  const name = String(body.name ?? "").trim();
  const category = String(body.category ?? "").trim();
  const amount = Number(body.amount);
  const currency = String(body.currency ?? "DOP").trim() || "DOP";
  const frequency = normalizeSubscriptionFrequency(String(body.frequency ?? ""));
  const nextChargeDate = String(body.nextChargeDate ?? "").slice(0, 10);
  const status = normalizeSubscriptionStatus(String(body.status ?? ""));

  if (!name) throw new Error("El nombre del servicio es obligatorio.");
  if (!category) throw new Error("La categoria es obligatoria.");
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El monto debe ser mayor a cero.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextChargeDate)) {
    throw new Error("La fecha del proximo cobro es obligatoria.");
  }

  return {
    name,
    category,
    amount,
    currency,
    frequency,
    nextChargeDate: new Date(`${nextChargeDate}T00:00:00`),
    autoRenew: Boolean(body.autoRenew),
    status,
    notes: String(body.notes ?? "").trim(),
  };
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const rows = await prisma.$queryRawUnsafe<SubscriptionRow[]>(
      `SELECT *
       FROM "Subscription"
       WHERE "userId" = $1
       ORDER BY "nextChargeDate" ASC, "name" ASC`,
      user.id
    );

    return NextResponse.json(
      { ok: true, data: rows.map(mapRow) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("API /subscriptions GET error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    const input = parseInput(await req.json());
    const id = randomUUID();
    const rows = await prisma.$queryRawUnsafe<SubscriptionRow[]>(
      `INSERT INTO "Subscription"
       ("id", "userId", "name", "category", "amount", "currency", "frequency", "nextChargeDate", "autoRenew", "status", "notes", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
       RETURNING *`,
      id,
      user.id,
      input.name,
      input.category,
      input.amount,
      input.currency,
      input.frequency,
      input.nextChargeDate,
      input.autoRenew,
      input.status.toUpperCase(),
      input.notes || null
    );

    return NextResponse.json({ ok: true, data: mapRow(rows[0]) });
  } catch (error) {
    console.error("API /subscriptions POST error:", error);
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
    if (!id) throw new Error("Falta el id de la suscripcion.");
    const input = parseInput(body.subscription ?? body);

    const rows = await prisma.$queryRawUnsafe<SubscriptionRow[]>(
      `UPDATE "Subscription"
       SET "name" = $1,
           "category" = $2,
           "amount" = $3,
           "currency" = $4,
           "frequency" = $5,
           "nextChargeDate" = $6,
           "autoRenew" = $7,
           "status" = $8,
           "notes" = $9,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $10 AND "userId" = $11
       RETURNING *`,
      input.name,
      input.category,
      input.amount,
      input.currency,
      input.frequency,
      input.nextChargeDate,
      input.autoRenew,
      input.status.toUpperCase(),
      input.notes || null,
      id,
      user.id
    );

    if (!rows[0]) throw new Error("No se encontro la suscripcion.");
    return NextResponse.json({ ok: true, data: mapRow(rows[0]) });
  } catch (error) {
    console.error("API /subscriptions PATCH error:", error);
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
    if (!id) throw new Error("Falta el id de la suscripcion.");

    await prisma.$queryRawUnsafe(
      `UPDATE "Subscription"
       SET "status" = 'CANCELADA', "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1 AND "userId" = $2`,
      id,
      user.id
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API /subscriptions DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 400 }
    );
  }
}
