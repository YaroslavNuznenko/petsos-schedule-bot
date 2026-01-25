-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Create new Vet table with platform and platformUserId
CREATE TABLE "new_Vet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "platform" TEXT NOT NULL DEFAULT 'telegram',
    "platformUserId" BIGINT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Copy data from old table to new table
-- Set platform to 'telegram' and copy telegramUserId to platformUserId
INSERT INTO "new_Vet" ("id", "platform", "platformUserId", "name", "phone", "isAdmin", "createdAt", "updatedAt")
SELECT 
    "id",
    'telegram' as "platform",
    "telegramUserId" as "platformUserId",
    "name",
    "phone",
    "isAdmin",
    "createdAt",
    "updatedAt"
FROM "Vet";

-- Drop old table
DROP TABLE "Vet";

-- Rename new table to Vet
ALTER TABLE "new_Vet" RENAME TO "Vet";

-- Drop old unique index if exists
DROP INDEX IF EXISTS "Vet_telegramUserId_key";

-- Create unique index on platform and platformUserId
CREATE UNIQUE INDEX "Vet_platform_platformUserId_key" ON "Vet"("platform", "platformUserId");

-- Create index on platform and platformUserId
CREATE INDEX "Vet_platform_platformUserId_idx" ON "Vet"("platform", "platformUserId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
