import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { SEAT_STATUSES } from './constants';

type Tx = Prisma.TransactionClient;

/** Classes that still accept automatic placements: open, in an active period that has not ended. */
export function openClassWhere(courseId: string, campusId?: string): Prisma.ClassGroupWhereInput {
  const now = new Date();
  return {
    courseId,
    ...(campusId ? { campusId } : {}),
    status: 'ABERTA',
    campus: { active: true },
    period: {
      active: true,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      AND: [{ OR: [{ enrollmentClosesAt: null }, { enrollmentClosesAt: { gt: now } }] }],
    },
  };
}

/** Number of occupied seats per class (pending, under review and accepted registrations). */
export async function seatsTaken(db: PrismaService | Tx, classIds: string[]) {
  if (!classIds.length) return new Map<string, number>();
  const rows = await db.registration.groupBy({
    by: ['classId'],
    where: { classId: { in: classIds }, status: { in: SEAT_STATUSES } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.classId!, r._count._all]));
}

/** Open classes for a course with remaining seats, soonest period first. */
export async function availableClasses(db: PrismaService, courseId: string, campusId?: string) {
  const classes = await db.classGroup.findMany({
    where: openClassWhere(courseId, campusId),
    include: {
      period: { select: { name: true, startsAt: true, endsAt: true } },
      campus: { select: { id: true, name: true } },
    },
    orderBy: [{ period: { startsAt: 'asc' } }, { createdAt: 'asc' }],
  });
  const taken = await seatsTaken(
    db,
    classes.map((c) => c.id),
  );
  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    shift: c.shift,
    schedule: c.schedule,
    campus: c.campus,
    period: c.period,
    capacity: c.capacity,
    seatsLeft: Math.max(0, c.capacity - (taken.get(c.id) ?? 0)),
  }));
}

/**
 * Locks the class row and checks capacity. Must run inside a transaction so two concurrent
 * registrations cannot both take the last seat.
 */
export async function hasFreeSeat(tx: Tx, classId: string, ignoreRegistrationId?: string) {
  const [locked] = await tx.$queryRaw<{ capacity: number }[]>(
    Prisma.sql`SELECT "capacity" FROM "ClassGroup" WHERE "id" = ${classId} FOR UPDATE`,
  );
  if (!locked) return false;
  const taken = await tx.registration.count({
    where: {
      classId,
      status: { in: SEAT_STATUSES },
      ...(ignoreRegistrationId ? { id: { not: ignoreRegistrationId } } : {}),
    },
  });
  return taken < locked.capacity;
}

/** Picks the preferred class when it has seats, otherwise the first open class with seats. */
export async function allocateClass(
  tx: Tx,
  courseId: string,
  campusId: string,
  preferredClassId?: string | null,
) {
  const candidates = await tx.classGroup.findMany({
    where: openClassWhere(courseId, campusId),
    select: { id: true },
    orderBy: [{ period: { startsAt: 'asc' } }, { createdAt: 'asc' }],
  });
  const ordered = preferredClassId
    ? [
        ...candidates.filter((c) => c.id === preferredClassId),
        ...candidates.filter((c) => c.id !== preferredClassId),
      ]
    : candidates;
  for (const c of ordered) if (await hasFreeSeat(tx, c.id)) return c.id;
  return null;
}

/**
 * Fills free seats of a class with the oldest wait-listed registrations for the same course and campus.
 * Returns the ids of promoted registrations.
 */
export async function promoteWaitlist(tx: Tx, classId: string) {
  const group = await tx.classGroup.findUnique({
    where: { id: classId },
    select: { courseId: true, campusId: true, status: true },
  });
  if (!group || group.status !== 'ABERTA') return [];
  const promoted: string[] = [];
  while (await hasFreeSeat(tx, classId)) {
    const next = await tx.registration.findFirst({
      where: {
        waitlisted: true,
        courseId: group.courseId,
        campusId: group.campusId,
        status: { in: SEAT_STATUSES },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!next) break;
    await tx.registration.update({
      where: { id: next.id },
      data: { classId, waitlisted: false },
    });
    promoted.push(next.id);
  }
  return promoted;
}
