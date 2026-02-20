export function shortJalali(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
    day: "numeric",
    month: "long",
  }).format(d);
}
