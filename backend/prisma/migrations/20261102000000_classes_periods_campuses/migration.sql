CREATE TABLE "Campus" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "address" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Campus_name_key" ON "Campus"("name");

CREATE TABLE "Period" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "enrollmentClosesAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Period_active_startsAt_idx" ON "Period"("active", "startsAt");

CREATE TABLE "ClassGroup" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "campusId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "shift" TEXT NOT NULL DEFAULT 'MANHA',
  "schedule" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'ABERTA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassGroup_code_key" ON "ClassGroup"("code");
CREATE INDEX "ClassGroup_courseId_campusId_status_idx" ON "ClassGroup"("courseId", "campusId", "status");
CREATE INDEX "ClassGroup_periodId_idx" ON "ClassGroup"("periodId");
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Registration"
  ADD COLUMN "birthDate" TIMESTAMP(3),
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "documentType" TEXT,
  ADD COLUMN "documentNumber" TEXT,
  ADD COLUMN "educationLevel" TEXT,
  ADD COLUMN "occupation" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "emergencyName" TEXT,
  ADD COLUMN "emergencyPhone" TEXT,
  ADD COLUMN "referralSource" TEXT,
  ADD COLUMN "campusId" TEXT,
  ADD COLUMN "classId" TEXT,
  ADD COLUMN "waitlisted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Registration_classId_status_idx" ON "Registration"("classId", "status");
