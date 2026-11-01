CREATE TABLE "PeriodExtension" (
  "id" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "adminId" TEXT,
  "reason" TEXT NOT NULL DEFAULT '',
  "previousEndsAt" TIMESTAMP(3),
  "newEndsAt" TIMESTAMP(3),
  "previousEnrollmentClosesAt" TIMESTAMP(3),
  "newEnrollmentClosesAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PeriodExtension_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PeriodExtension_periodId_createdAt_idx" ON "PeriodExtension"("periodId", "createdAt");
ALTER TABLE "PeriodExtension" ADD CONSTRAINT "PeriodExtension_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;
