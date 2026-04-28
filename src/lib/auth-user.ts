import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

export async function getOrCreateUser(session: Session) {
  const email = session.user?.email;

  if (!email) {
    throw new Error("No se encontró el email del usuario autenticado.");
  }

  return prisma.user.upsert({
    where: { email },
    update: {
      name: session.user?.name,
      image: session.user?.image,
    },
    create: {
      email,
      name: session.user?.name,
      image: session.user?.image,
    },
  });
}