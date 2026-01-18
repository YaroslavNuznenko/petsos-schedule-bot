import { PrismaClient } from "@prisma/client";
import { Context } from "telegraf";

const prisma = new PrismaClient();

export async function getOrCreateVetFromContext(ctx: Context) {
  const user = ctx.from;
  if (!user) {
    throw new Error("User context is missing");
  }

  const telegramUserId = BigInt(user.id);
  
  let name: string | null = null;
  if (user.first_name) {
    name = user.last_name 
      ? `${user.first_name} ${user.last_name}`.trim()
      : user.first_name;
  } else if (user.username) {
    name = `@${user.username}`;
  }

  let vet = await prisma.vet.findUnique({
    where: { telegramUserId },
  });

  if (!vet) {
    vet = await prisma.vet.create({
      data: {
        telegramUserId,
        name,
        phone: null,
      },
    });
  } else {
    if (name && vet.name !== name) {
      vet = await prisma.vet.update({
        where: { id: vet.id },
        data: { name },
      });
    }
  }

  return vet;
}

export async function updateVetPhone(telegramUserId: bigint, phone: string) {
  return prisma.vet.update({
    where: { telegramUserId },
    data: { phone },
  });
}

export async function vetHasPhone(telegramUserId: bigint): Promise<boolean> {
  const vet = await prisma.vet.findUnique({
    where: { telegramUserId },
    select: { phone: true },
  });
  
  return vet ? vet.phone !== null : false;
}

export { prisma };
