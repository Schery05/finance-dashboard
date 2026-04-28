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

async function main() {
  const email = process.env.MIGRATION_USER_EMAIL ?? "yamilet.schery05@gmail.com";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No encontre el usuario ${email}`);

  const [transactions, categories, budgets, goals, movements] =
    await Promise.all([
      prisma.transaction.count({ where: { userId: user.id } }),
      prisma.category.count({ where: { userId: user.id } }),
      prisma.budget.count({ where: { userId: user.id } }),
      prisma.savingsGoal.count({ where: { userId: user.id } }),
      prisma.savingsMovement.count({ where: { userId: user.id } }),
    ]);

  console.log(
    JSON.stringify(
      {
        user: user.email,
        transactions,
        categories,
        budgets,
        goals,
        movements,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
