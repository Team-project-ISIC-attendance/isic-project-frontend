const MIN_WEEKS = 1;
const MAX_WEEKS = 52;
const DAYS_PER_WEEK = 7;
const LAST_TEACHING_DAY_OFFSET = 4;

export function clampWeekCount(value: number): number {
  return Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, value));
}

export function parseSemesterDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatSemesterDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekMonday(value: Date): Date {
  const monday = new Date(value);
  const dayOfWeek = monday.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);
  return monday;
}

export function getWeekCountFromRange(
  startDateValue: string,
  endDateValue: string,
): number | null {
  const start = parseSemesterDate(startDateValue);
  const end = parseSemesterDate(endDateValue);
  if (!start || !end || end < start) return null;

  const startMonday = getWeekMonday(start);
  const endMonday = getWeekMonday(end);
  const diffInDays = Math.floor(
    (endMonday.getTime() - startMonday.getTime()) / (1000 * 60 * 60 * 24),
  );

  return clampWeekCount(Math.floor(diffInDays / DAYS_PER_WEEK) + 1);
}

export function getEndDateFromWeeks(
  startDateValue: string,
  totalWeeksValue: number,
): string {
  const start = parseSemesterDate(startDateValue);
  if (!start) return "";

  const monday = getWeekMonday(start);
  const end = new Date(monday);
  end.setUTCDate(
    end.getUTCDate() +
      (clampWeekCount(totalWeeksValue) - 1) * DAYS_PER_WEEK +
      LAST_TEACHING_DAY_OFFSET,
  );

  if (end < start) {
    return formatSemesterDate(start);
  }

  return formatSemesterDate(end);
}

export function getWeekdayDate(
  startDateValue: string,
  weekNumber: number,
  dayOfWeek: number,
): Date | null {
  const start = parseSemesterDate(startDateValue);
  if (!start || weekNumber < 1 || dayOfWeek < 1 || dayOfWeek > DAYS_PER_WEEK) {
    return null;
  }

  const monday = getWeekMonday(start);
  const value = new Date(monday);
  value.setUTCDate(
    value.getUTCDate() + (weekNumber - 1) * DAYS_PER_WEEK + (dayOfWeek - 1),
  );
  return value;
}
