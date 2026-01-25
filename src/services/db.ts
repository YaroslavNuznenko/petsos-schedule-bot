import { PrismaClient } from "@prisma/client";
import { Slot } from "../domain/schema";

const prisma = new PrismaClient();

export async function getOrCreateVet(platform: string, platformUserId: string | bigint, name?: string) {
  const userId = typeof platformUserId === "string" ? BigInt(platformUserId) : platformUserId;
  
  let vet = await prisma.vet.findUnique({
    where: {
      platform_platformUserId: {
        platform,
        platformUserId: userId,
      }
    },
  });

  if (!vet) {
    vet = await prisma.vet.create({
      data: {
        platform,
        platformUserId: userId,
        name: name || null,
      },
    });
  } else if (name && vet.name !== name) {
    vet = await prisma.vet.update({
      where: { id: vet.id },
      data: { name },
    });
  }

  return vet;
}

export async function saveSlots(
  vetId: number,
  slots: Slot[],
  source: string = "text"
) {
  if (slots.length === 0) {
    return { count: 0 };
  }

  const existingSlots = await prisma.availabilitySlot.findMany({
    where: { vetId },
    select: { date: true, startTime: true, type: true },
  });

  const existingKeys = new Set(
    existingSlots.map((s) => `${s.date}_${s.startTime}_${s.type}`)
  );

  const newSlots = slots.filter(
    (slot) => !existingKeys.has(`${slot.date}_${slot.startTime}_${slot.type}`)
  );

  if (newSlots.length === 0) {
    return { count: 0 };
  }

  return prisma.availabilitySlot.createMany({
    data: newSlots.map((slot) => ({
      vetId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      type: slot.type,
      source,
    })),
  });
}

export async function getVetSlots(vetId: number) {
  return prisma.availabilitySlot.findMany({
    where: { vetId },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function getVetSlotsForWeek(vetId: number, startDate: Date) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  return prisma.availabilitySlot.findMany({
    where: {
      vetId,
      date: {
        gte: startDateStr,
        lt: endDateStr,
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function getAllSlotsForWeek(startDate: Date) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  return prisma.availabilitySlot.findMany({
    where: {
      date: {
        gte: startDateStr,
        lt: endDateStr,
      },
    },
    include: {
      vet: true,
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function getVetSlotsForMonth(vetId: number, yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const startDateStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return prisma.availabilitySlot.findMany({
    where: {
      vetId,
      date: {
        gte: startDateStr,
        lte: endDateStr,
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function getAllSlotsForMonth(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const startDateStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return prisma.availabilitySlot.findMany({
    where: {
      date: {
        gte: startDateStr,
        lte: endDateStr,
      },
    },
    include: {
      vet: true,
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function deleteVetSlotsForMonth(vetId: number, yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const startDateStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return prisma.availabilitySlot.deleteMany({
    where: {
      vetId,
      date: {
        gte: startDateStr,
        lte: endDateStr,
      },
    },
  });
}

export async function getAllSlotsForMonthByType(yearMonth: string, type: "URGENT" | "VP") {
  const [year, month] = yearMonth.split("-").map(Number);
  const startDateStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return prisma.availabilitySlot.findMany({
    where: {
      date: {
        gte: startDateStr,
        lte: endDateStr,
      },
      type,
    },
    include: {
      vet: true,
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export { prisma };
