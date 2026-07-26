import { addDays, startOfWeek, format, isSameDay, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

export function weekDays(anchor: Date = new Date()): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function fmtDayHeader(d: Date) {
  return format(d, "EEEE, d MMM", { locale: ru });
}

export function fmtShortDay(d: Date) {
  return format(d, "EEEEEE d", { locale: ru });
}

export function fmtTime(d: Date | string) {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "HH:mm");
}

export function sameDay(a: Date | string, b: Date) {
  const da = typeof a === "string" ? parseISO(a) : a;
  return isSameDay(da, b);
}

export function fmtDate(d: Date | string) {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "d MMM, HH:mm", { locale: ru });
}
