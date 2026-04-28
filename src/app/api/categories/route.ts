import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getOrCreateUser } from "@/lib/auth-user";
import {
  DEFAULT_GASTO_CATEGORIES,
  DEFAULT_INGRESO_CATEGORIES,
  type CategoryType,
  type ManagedCategories,
} from "@/lib/categories";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type DBCategoryType = "INGRESO" | "GASTO";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

async function getAuthenticatedUser() {
  const session = await getServerSession();

  if (!session) {
    throw new Error("No autorizado");
  }

  return getOrCreateUser(session);
}

function mapTypeToDB(type: CategoryType): DBCategoryType {
  return type === "Ingreso" ? "INGRESO" : "GASTO";
}

function mapTypeToUI(type: string): CategoryType {
  return type === "INGRESO" ? "Ingreso" : "Gasto";
}

function groupCategories(
  categories: Array<{ name: string; type: string }>
): ManagedCategories {
  const grouped: ManagedCategories = {
    Ingreso: [],
    Gasto: [],
  };

  for (const category of categories) {
    grouped[mapTypeToUI(category.type)].push(category.name);
  }

  return {
    Ingreso: Array.from(new Set(grouped.Ingreso)).sort((a, b) =>
      a.localeCompare(b)
    ),
    Gasto: Array.from(new Set(grouped.Gasto)).sort((a, b) =>
      a.localeCompare(b)
    ),
  };
}

async function seedDefaultCategories(userId: string) {
  const defaults = [
    ...DEFAULT_INGRESO_CATEGORIES.map((name) => ({
      name,
      type: "INGRESO" as const,
    })),
    ...DEFAULT_GASTO_CATEGORIES.map((name) => ({
      name,
      type: "GASTO" as const,
    })),
  ];

  for (const category of defaults) {
    await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId,
          name: category.name,
          type: category.type,
        },
      },
      update: {},
      create: {
        userId,
        name: category.name,
        type: category.type,
      },
    });
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    await seedDefaultCategories(user.id);

    const categories = await prisma.category.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      select: {
        name: true,
        type: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(
      { ok: true, data: groupCategories(categories) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("API /categories GET error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const type = body.type as CategoryType;

    if (!name) throw new Error("El nombre de la categoria es obligatorio.");
    if (type !== "Ingreso" && type !== "Gasto") {
      throw new Error("Tipo de categoria invalido.");
    }

    const category = await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId: user.id,
          name,
          type: mapTypeToDB(type),
        },
      },
      update: {
        isActive: true,
      },
      create: {
        userId: user.id,
        name,
        type: mapTypeToDB(type),
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    return NextResponse.json({ ok: true, data: category });
  } catch (error) {
    console.error("API /categories POST error:", error);
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
    const oldName = String(body.oldName ?? "").trim();
    const newName = String(body.newName ?? "").trim();
    const type = body.type as CategoryType;
    const dbType = mapTypeToDB(type);

    if (!oldName) throw new Error("La categoria actual es obligatoria.");
    if (!newName) throw new Error("El nuevo nombre es obligatorio.");
    if (type !== "Ingreso" && type !== "Gasto") {
      throw new Error("Tipo de categoria invalido.");
    }

    if (oldName.toLowerCase() === newName.toLowerCase()) {
      return NextResponse.json({ ok: true });
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.category.findUnique({
        where: {
          userId_name_type: {
            userId: user.id,
            name: oldName,
            type: dbType,
          },
        },
      });

      if (!current) throw new Error("No se encontro la categoria.");

      const target = await tx.category.findUnique({
        where: {
          userId_name_type: {
            userId: user.id,
            name: newName,
            type: dbType,
          },
        },
      });

      if (!target) {
        await tx.category.update({
          where: {
            id: current.id,
          },
          data: {
            name: newName,
            isActive: true,
          },
        });
        return;
      }

      await tx.category.update({
        where: {
          id: target.id,
        },
        data: {
          isActive: true,
        },
      });

      await tx.transaction.updateMany({
        where: {
          userId: user.id,
          categoryId: current.id,
        },
        data: {
          categoryId: target.id,
        },
      });

      const budgets = await tx.budget.findMany({
        where: {
          userId: user.id,
          categoryId: current.id,
        },
      });

      for (const budget of budgets) {
        const existingBudget = await tx.budget.findUnique({
          where: {
            userId_categoryId_month_year: {
              userId: user.id,
              categoryId: target.id,
              month: budget.month,
              year: budget.year,
            },
          },
        });

        if (existingBudget) {
          await tx.budget.delete({
            where: {
              id: budget.id,
            },
          });
        } else {
          await tx.budget.update({
            where: {
              id: budget.id,
            },
            data: {
              categoryId: target.id,
            },
          });
        }
      }

      await tx.category.delete({
        where: {
          id: current.id,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API /categories PATCH error:", error);
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
    const name = String(body.name ?? "").trim();
    const type = body.type as CategoryType;

    if (!name) throw new Error("El nombre de la categoria es obligatorio.");
    if (type !== "Ingreso" && type !== "Gasto") {
      throw new Error("Tipo de categoria invalido.");
    }

    const dbType = mapTypeToDB(type);
    const category = await prisma.category.findUnique({
      where: {
        userId_name_type: {
          userId: user.id,
          name,
          type: dbType,
        },
      },
    });

    if (!category) return NextResponse.json({ ok: true });

    const [transactionsCount, budgetsCount] = await Promise.all([
      prisma.transaction.count({
        where: {
          userId: user.id,
          categoryId: category.id,
        },
      }),
      prisma.budget.count({
        where: {
          userId: user.id,
          categoryId: category.id,
        },
      }),
    ]);

    if (transactionsCount === 0 && budgetsCount === 0) {
      await prisma.category.delete({
        where: {
          id: category.id,
        },
      });
    } else {
      await prisma.category.update({
        where: {
          id: category.id,
        },
        data: {
          isActive: false,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API /categories DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: errorMessage(error) === "No autorizado" ? 401 : 400 }
    );
  }
}
