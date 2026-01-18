-- CreateTable
CREATE TABLE "Vet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegramUserId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vetId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AvailabilitySlot_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "Vet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Vet_telegramUserId_key" ON "Vet"("telegramUserId");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_vetId_date_idx" ON "AvailabilitySlot"("vetId", "date");
