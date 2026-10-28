export function clinicDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

function wallTime(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: string): string => parts.find(part => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

/** Resolve clinic-local wall time without using the browser's zone. Gaps and
 * repeated DST times require a different slot rather than an implicit guess. */
export function clinicLocalToUtc(local: string, timeZone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error("Invalid clinic-local time.");
  const nominal = new Date(`${local}:00Z`).getTime();
  if (!Number.isFinite(nominal)) throw new Error("Invalid clinic-local time.");
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = nominal + hours * 3_600_000;
    offsets.add(new Date(`${wallTime(new Date(probe), timeZone)}:00Z`).getTime() - probe);
  }
  const matches = [...offsets].map(offset => new Date(nominal - offset)).filter(candidate => wallTime(candidate, timeZone) === local);
  if (matches.length !== 1) throw new Error("Choose an unambiguous clinic-local time outside the daylight-saving transition.");
  return matches[0];
}
