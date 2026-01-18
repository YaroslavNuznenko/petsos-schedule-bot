/*
  Warnings:

  - You are about to alter the column `telegramUserId` on the `Vet` table. The data in that column could be lost. The data in that column will be cast from `String` to `BigInt`.
  - Made the column `source` on table `AvailabilitySlot` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AvailabilitySlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vetId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AvailabilitySlot_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "Vet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AvailabilitySlot" ("createdAt", "date", "endTime", "id", "source", "startTime", "type", "vetId") SELECT "createdAt", "date", "endTime", "id", "source", "startTime", "type", "vetId" FROM "AvailabilitySlot";
DROP TABLE "AvailabilitySlot";
ALTER TABLE "new_AvailabilitySlot" RENAME TO "AvailabilitySlot";
CREATE INDEX "AvailabilitySlot_vetId_date_idx" ON "AvailabilitySlot"("vetId", "date");
CREATE UNIQUE INDEX "AvailabilitySlot_vetId_date_startTime_type_key" ON "AvailabilitySlot"("vetId", "date", "startTime", "type");
CREATE TABLE "new_Vet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegramUserId" BIGINT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Vet" ("createdAt", "id", "name", "telegramUserId", "updatedAt") SELECT "createdAt", "id", "name", "telegramUserId", "updatedAt" FROM "Vet";
DROP TABLE "Vet";
ALTER TABLE "new_Vet" RENAME TO "Vet";
CREATE UNIQUE INDEX "Vet_telegramUserId_key" ON "Vet"("telegramUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
