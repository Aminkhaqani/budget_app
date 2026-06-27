import {
  addDays as addDateDays,
  addMonths,
  format,
  getDate,
  getDay,
  getMonth,
  getYear,
  isValid,
  parse,
  startOfMonth,
  startOfYear,
} from "date-fns-jalali";
import { faIR } from "date-fns-jalali/locale/fa-IR";

export type JalaliParts = {
  year: number;
  month: number;
  day: number;
};

function fromISODate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toISODate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(iso: string, delta: number) {
  return toISODate(addDateDays(fromISODate(iso), delta));
}

export function shortJalali(iso: string) {
  return format(fromISODate(iso), "d MMMM", { locale: faIR });
}

export function fullJalali(iso: string) {
  return format(fromISODate(iso), "EEEE d MMMM yyyy", { locale: faIR });
}

export function jalaliISODate(iso: string) {
  return format(fromISODate(iso), "yyyy-MM-dd");
}

export function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function normalizeJalaliDateInput(value: string) {
  const normalized = normalizeDigits(value).trim().replaceAll("/", "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${String(Number(month)).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
}

export function parseJalaliISODate(value: string) {
  const normalized = normalizeJalaliDateInput(value);
  if (!normalized) return null;
  const parsed = parse(normalized, "yyyy-MM-dd", new Date());
  if (!isValid(parsed)) return null;
  return format(parsed, "yyyy-MM-dd") === normalized ? toISODate(parsed) : null;
}

export function jalaliParts(iso: string): JalaliParts {
  const date = fromISODate(iso);
  return {
    year: getYear(date),
    month: getMonth(date) + 1,
    day: getDate(date),
  };
}

export function jalaliMonthTitle(year: number, month: number) {
  return format(fromISODate(findGregorianForJalali(year, month, 1)), "MMMM yyyy", { locale: faIR });
}

export function jalaliWeekday(iso: string) {
  return format(fromISODate(iso), "EEEEEE", { locale: faIR });
}

export function compareISO(a: string, b: string) {
  return a.localeCompare(b);
}

export function isBetweenISO(iso: string, from: string, to: string) {
  return compareISO(iso, from) >= 0 && compareISO(iso, to) <= 0;
}

export function findGregorianForJalali(year: number, month: number, day: number) {
  const parsed = parse(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    "yyyy-MM-dd",
    new Date()
  );
  return isValid(parsed) ? toISODate(parsed) : todayISO();
}

export function jalaliMonthBounds(year: number, month: number) {
  const start = findGregorianForJalali(year, month, 1);
  const nextMonth = shiftJalaliMonth(year, month, 1);
  return {
    start,
    end: addDays(findGregorianForJalali(nextMonth.year, nextMonth.month, 1), -1),
  };
}

export function shiftJalaliMonth(year: number, month: number, delta: number) {
  const shifted = addMonths(fromISODate(findGregorianForJalali(year, month, 1)), delta);
  return {
    year: getYear(shifted),
    month: getMonth(shifted) + 1,
  };
}

export function currentJalaliMonthBounds() {
  const today = todayISO();
  return {
    start: toISODate(startOfMonth(fromISODate(today))),
    end: today,
  };
}

export function jalaliYearBounds(anchorISO = todayISO()) {
  return {
    start: toISODate(startOfYear(fromISODate(anchorISO))),
    end: anchorISO,
  };
}

export function currentJalaliYearBounds() {
  return jalaliYearBounds(todayISO());
}

export function lastNDaysBounds(days: number, anchorISO = todayISO()) {
  return {
    start: addDays(anchorISO, -(days - 1)),
    end: anchorISO,
  };
}

export function jalaliMonthKey(iso: string) {
  return format(fromISODate(iso), "yyyy-MM");
}

export function jalaliMonthShortLabel(iso: string) {
  return format(fromISODate(iso), "yyyy/MM");
}

export function jalaliDayOfWeekIndex(iso: string) {
  return getDay(fromISODate(iso));
}
