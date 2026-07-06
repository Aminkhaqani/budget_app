import { useEffect, useMemo, useState } from "react";
import { fullJalali } from "../lib/date";
import {
  loadBudgetProfiles,
  loadSupportTickets,
  updateSupportTicket,
  type BudgetProfile,
  type SupportTicket,
} from "../lib/budgetStore";

const fmt = new Intl.NumberFormat("fa-IR");

function categoryLabel(category: SupportTicket["category"]) {
  if (category === "bug") return "باگ";
  if (category === "improvement") return "پیشنهاد بهبود";
  if (category === "error") return "خطا";
  if (category === "question") return "سوال";
  return "سایر";
}

function statusLabel(status: SupportTicket["status"]) {
  if (status === "open") return "باز";
  if (status === "in_progress") return "در حال بررسی";
  if (status === "resolved") return "حل‌شده";
  return "بسته";
}

function priorityLabel(priority: SupportTicket["priority"]) {
  if (priority === "high") return "مهم";
  if (priority === "low") return "کم‌اهمیت";
  return "معمولی";
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [profiles, setProfiles] = useState<BudgetProfile[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | SupportTicket["status"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    Promise.all([loadSupportTickets(), loadBudgetProfiles()])
      .then(([nextTickets, nextProfiles]) => {
        setTickets(nextTickets);
        setProfiles(nextProfiles);
        setSelectedId((current) => current ?? nextTickets[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    Promise.all([loadSupportTickets(), loadBudgetProfiles()])
      .then(([nextTickets, nextProfiles]) => {
        if (!active) return;
        setTickets(nextTickets);
        setProfiles(nextProfiles);
        setSelectedId((current) => current ?? nextTickets[0]?.id ?? null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredTickets = useMemo(
    () => (statusFilter === "all" ? tickets : tickets.filter((ticket) => ticket.status === statusFilter)),
    [statusFilter, tickets]
  );
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? filteredTickets[0] ?? null;
  const customer = selected ? profiles.find((profile) => profile.id === selected.customerId) : undefined;
  const openCount = tickets.filter((ticket) => ticket.status === "open" || ticket.status === "in_progress").length;

  const patchTicket = async (patch: Partial<Pick<SupportTicket, "status" | "priority" | "adminNote">>) => {
    if (!selected) return;
    const saved = await updateSupportTicket({ id: selected.id, ...patch });
    setTickets((current) => current.map((ticket) => (ticket.id === saved.id ? saved : ticket)));
  };

  return (
    <div className="space-y-4 pb-6" dir="rtl">
      <div className="sticky top-0 z-30 -mx-8 bg-bg/95 px-8 pb-3 pt-6 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-extrabold text-ink">پیام‌های پشتیبانی</div>
            <div className="mt-1 text-xs text-muted">تیکت‌های باگ، پیشنهاد، خطا و سوال مشتری‌ها</div>
          </div>
          <button onClick={refresh} className="rounded-2xl bg-white px-4 py-2 text-xs font-extrabold text-muted ring-1 ring-black/5">
            تازه‌سازی
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric title="کل تیکت‌ها" value={tickets.length} />
        <Metric title="باز و در جریان" value={openCount} />
        <Metric title="حل‌شده" value={tickets.filter((ticket) => ticket.status === "resolved").length} />
        <Metric title="مهم" value={tickets.filter((ticket) => ticket.priority === "high").length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.25fr]">
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-ink">صندوق پیام</div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="rounded-2xl bg-bg px-3 py-2 text-xs font-bold text-ink outline-none"
            >
              <option value="all">همه</option>
              <option value="open">باز</option>
              <option value="in_progress">در حال بررسی</option>
              <option value="resolved">حل‌شده</option>
              <option value="closed">بسته</option>
            </select>
          </div>

          <div className="mt-3 max-h-[68vh] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-2xl bg-bg px-3 py-3 text-xs text-muted">در حال دریافت...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-2xl bg-bg px-3 py-3 text-xs text-muted">پیامی در این فیلتر نیست.</div>
            ) : (
              filteredTickets.map((ticket) => {
                const profile = profiles.find((entry) => entry.id === ticket.customerId);
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedId(ticket.id)}
                    className={`w-full rounded-2xl px-3 py-3 text-right ring-1 transition ${
                      selected?.id === ticket.id ? "bg-navy-900 text-white ring-navy-900" : "bg-bg text-ink ring-black/5 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold">{ticket.subject}</div>
                        <div className={`mt-1 truncate text-[11px] ${selected?.id === ticket.id ? "text-white/65" : "text-muted"}`}>
                          {profile?.displayName || profile?.email || "مشتری"} · {categoryLabel(ticket.category)}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold ${selected?.id === ticket.id ? "bg-white/10 text-white" : "bg-white text-muted ring-1 ring-black/5"}`}>
                        {statusLabel(ticket.status)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          {!selected ? (
            <div className="rounded-2xl bg-bg px-3 py-4 text-xs text-muted">یک پیام را انتخاب کن.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-base font-extrabold text-ink">{selected.subject}</div>
                  <div className="mt-1 text-xs text-muted">
                    {customer?.displayName || customer?.email || "مشتری"} · {selected.createdAt ? fullJalali(selected.createdAt.slice(0, 10)) : ""}
                  </div>
                </div>
                <span className="rounded-full bg-bg px-3 py-1 text-xs font-extrabold text-muted">
                  {priorityLabel(selected.priority)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <SelectBox
                  label="وضعیت"
                  value={selected.status}
                  onChange={(value) => void patchTicket({ status: value as SupportTicket["status"] })}
                  options={[
                    ["open", "باز"],
                    ["in_progress", "در حال بررسی"],
                    ["resolved", "حل‌شده"],
                    ["closed", "بسته"],
                  ]}
                />
                <SelectBox
                  label="اولویت"
                  value={selected.priority}
                  onChange={(value) => void patchTicket({ priority: value as SupportTicket["priority"] })}
                  options={[
                    ["low", "کم"],
                    ["normal", "معمولی"],
                    ["high", "مهم"],
                  ]}
                />
                <div className="rounded-2xl bg-bg px-3 py-2">
                  <div className="text-[10px] font-bold text-muted">نوع</div>
                  <div className="mt-1 text-sm font-extrabold text-ink">{categoryLabel(selected.category)}</div>
                </div>
              </div>

              <div className="rounded-3xl bg-bg p-4">
                <div className="text-xs font-extrabold text-muted">شرح مشتری</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink">{selected.body}</div>
              </div>

              <AdminNoteEditor key={selected.id} ticket={selected} onSave={(adminNote) => void patchTicket({ adminNote })} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="text-xs font-bold text-muted">{title}</div>
      <div className="mt-2 text-xl font-extrabold text-ink">{fmt.format(value)}</div>
    </div>
  );
}

function SelectBox({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-2xl bg-bg px-3 py-2">
      <span className="text-[10px] font-bold text-muted">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full bg-transparent text-sm font-extrabold text-ink outline-none">
        {options.map(([id, title]) => (
          <option key={id} value={id}>
            {title}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdminNoteEditor({ ticket, onSave }: { ticket: SupportTicket; onSave: (adminNote: string) => void }) {
  const [note, setNote] = useState(ticket.adminNote ?? "");

  return (
    <div className="rounded-3xl bg-bg p-4">
      <div className="text-xs font-extrabold text-muted">یادداشت ادمین</div>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={5}
        className="mt-2 w-full resize-none rounded-2xl bg-white px-3 py-3 text-sm leading-7 text-ink ring-1 ring-black/5 outline-none"
        placeholder="اقدام انجام‌شده یا توضیح داخلی"
      />
      <button onClick={() => onSave(note.trim())} className="mt-3 rounded-2xl bg-navy-900 px-4 py-3 text-sm font-extrabold text-white">
        ذخیره یادداشت
      </button>
    </div>
  );
}
