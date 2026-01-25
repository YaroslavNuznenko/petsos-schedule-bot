import { PrismaClient } from "@prisma/client";
import { Context } from "telegraf";

const prisma = new PrismaClient();

export async function getOrCreateVetFromContext(ctx: Context, platform: string = "telegram") {
  const user = ctx.from;
  if (!user) {
    throw new Error("User context is missing");
  }

  const platformUserId = BigInt(user.id);
  
  let name: string | null = null;
  if (user.first_name) {
    name = user.last_name 
      ? `${user.first_name} ${user.last_name}`.trim()
      : user.first_name;
  } else if (user.username) {
    name = `@${user.username}`;
  }

  let vet = await prisma.vet.findUnique({
    where: { 
      platform_platformUserId: {
        platform,
        platformUserId,
      }
    },
  });

  if (!vet) {
    vet = await prisma.vet.create({
      data: {
        platform,
        platformUserId,
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

export async function updateVetPhone(platform: string, platformUserId: bigint, phone: string) {
  return prisma.vet.update({
    where: {
      platform_platformUserId: {
        platform,
        platformUserId,
      }
    },
    data: { phone },
  });
}

export async function vetHasPhone(platform: string, platformUserId: bigint): Promise<boolean> {
  const vet = await prisma.vet.findUnique({
    where: {
      platform_platformUserId: {
        platform,
        platformUserId,
      }
    },
    select: { phone: true },
  });
  
  return vet ? vet.phone !== null : false;
}

export async function isVetAdmin(platform: string, platformUserId: bigint): Promise<boolean> {
  const vet = await prisma.vet.findUnique({
    where: {
      platform_platformUserId: {
        platform,
        platformUserId,
      }
    },
    select: { isAdmin: true },
  });
  return vet?.isAdmin || false;
}

export async function setVetAdmin(platform: string, platformUserId: bigint, isAdmin: boolean) {
  return prisma.vet.update({
    where: {
      platform_platformUserId: {
        platform,
        platformUserId,
      }
    },
    data: { isAdmin },
  });
}

export { prisma };
