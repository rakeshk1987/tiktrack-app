export function toDate(value: string): Date {
  return new Date(value);
}

export function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

export function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  const aStart = toDate(startA).getTime();
  const aEnd = toDate(endA).getTime();
  const bStart = toDate(startB).getTime();
  const bEnd = toDate(endB).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function minutesBetween(start: string, end: string): number {
  const ms = toDate(end).getTime() - toDate(start).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

export function toIsoDateKey(value: string): string {
  return value.slice(0, 10);
}
