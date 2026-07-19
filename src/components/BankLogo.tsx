import type { Account } from "../layout/Appshell";

export const BANK_OPTIONS = [
  { key: "pasargad", label: "پاسارگاد" },
  { key: "blu", label: "بلوبانک" },
  { key: "saman", label: "سامان" },
  { key: "melli", label: "ملی" },
  { key: "cash", label: "نقدی" },
  { key: "generic", label: "عمومی" },
] as const;

type BankKey = (typeof BANK_OPTIONS)[number]["key"];

const bankStyles: Record<BankKey, { bg: string; fg: string; mark: string; ring: string }> = {
  pasargad: { bg: "#0b1b3a", fg: "#f5c542", mark: "پ", ring: "#f5c542" },
  blu: { bg: "#16a3ff", fg: "#ffffff", mark: "blu", ring: "#c7ebff" },
  saman: { bg: "#0a55a0", fg: "#ffffff", mark: "س", ring: "#b9d9ff" },
  melli: { bg: "#d71920", fg: "#ffffff", mark: "م", ring: "#ffd0d2" },
  cash: { bg: "#10b981", fg: "#ffffff", mark: "ن", ring: "#bbf7d0" },
  generic: { bg: "#64748b", fg: "#ffffff", mark: "ح", ring: "#e2e8f0" },
};

export function bankKey(account?: Pick<Account, "bankKey" | "title"> | null): BankKey {
  const raw = account?.bankKey;
  if (raw && raw in bankStyles) return raw as BankKey;

  const title = account?.title ?? "";
  if (title.includes("پاسارگاد")) return "pasargad";
  if (title.includes("بلو") || title.toLowerCase().includes("blu")) return "blu";
  if (title.includes("سامان")) return "saman";
  if (title.includes("ملی")) return "melli";
  if (title.includes("نقد")) return "cash";
  return "generic";
}

export function bankLabel(key?: string) {
  return BANK_OPTIONS.find((item) => item.key === key)?.label ?? "عمومی";
}

export function BankLogo({
  account,
  size = "md",
  className = "",
}: {
  account?: Pick<Account, "bankKey" | "title"> | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const style = bankStyles[bankKey(account)];
  const sizeClass = size === "sm" ? "h-7 w-7 text-[9px]" : size === "lg" ? "h-12 w-12 text-sm" : "h-10 w-10 text-xs";

  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-2xl font-black leading-none shadow-sm ${sizeClass} ${className}`}
      style={{
        backgroundColor: style.bg,
        color: style.fg,
        boxShadow: `0 0 0 1px ${style.ring}`,
      }}
      aria-hidden="true"
    >
      {style.mark}
    </span>
  );
}
