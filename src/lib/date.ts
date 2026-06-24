export type JalaliParts = {
  year: number;
  month: number;
  day: number;
};

const jalaliFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const longJalaliFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
  day: "numeric",
  month: "long",
});

const monthJalaliFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
  month: "long",
  year: "numeric",
});

const weekdayJalaliFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  weekday: "short",
});

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
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

export function shortJalali(iso: string) {
  return longJalaliFormatter.format(new Date(iso + "T00:00:00"));
}

export function fullJalali(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function jalaliISODate(iso: string) {
  const p = jalaliParts(iso);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function parseJalaliISODate(value: string) {
  const normalized = value.trim().replaceAll("/", "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return findGregorianForJalali(Number(year), Number(month), Number(day));
}

export function jalaliParts(iso: string): JalaliParts {
  const parts = jalaliFormatter.formatToParts(new Date(iso + "T00:00:00"));
  return {
    year: Number(parts.find((p) => p.type === "year")?.value ?? 0),
    month: Number(parts.find((p) => p.type === "month")?.value ?? 0),
    day: Number(parts.find((p) => p.type === "day")?.value ?? 0),
  };
}

export function jalaliMonthTitle(year: number, month: number) {
  const firstDay = findGregorianForJalali(year, month, 1);
  return monthJalaliFormatter.format(new Date(firstDay + "T00:00:00"));
}

export function jalaliWeekday(iso: string) {
  return weekdayJalaliFormatter.format(new Date(iso + "T00:00:00"));
}

export function compareISO(a: string, b: string) {
  return a.localeCompare(b);
}

export function isBetweenISO(iso: string, from: string, to: string) {
  return compareISO(iso, from) >= 0 && compareISO(iso, to) <= 0;
}

export function findGregorianForJalali(year: number, month: number, day: number) {
  const approx = new Date(Date.UTC(year + 621, Math.max(0, month - 2), day));
  for (let offset = -45; offset <= 45; offset += 1) {
    const d = new Date(approx);
    d.setUTCDate(approx.getUTCDate() + offset);
    const iso = toISODate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const parts = jalaliParts(iso);
    if (parts.year === year && parts.month === month && parts.day === day) return iso;
  }
  return toISODate(new Date());
}

export function jalaliMonthBounds(year: number, month: number) {
  const start = findGregorianForJalali(year, month, 1);
  let end = start;
  for (let iso = start; ; iso = addDays(iso, 1)) {
    const parts = jalaliParts(iso);
    if (parts.year !== year || parts.month !== month) break;
    end = iso;
  }
  return { start, end };
}

export function shiftJalaliMonth(year: number, month: number, delta: number) {
  const zeroBased = year * 12 + (month - 1) + delta;
  const normalizedMonth = ((zeroBased % 12) + 12) % 12;
  return {
    year: Math.floor(zeroBased / 12),
    month: normalizedMonth + 1,
  };
}

export function currentJalaliMonthBounds() {
  const { year, month } = jalaliParts(todayISO());
  return jalaliMonthBounds(year, month);
}

export function jalaliYearBounds(anchorISO = todayISO()) {
  const { year } = jalaliParts(anchorISO);
  return {
    start: findGregorianForJalali(year, 1, 1),
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
  const p = jalaliParts(iso);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function jalaliMonthShortLabel(iso: string) {
  const p = jalaliParts(iso);
  return `${p.year}/${String(p.month).padStart(2, "0")}`;
}
