import { useEffect, useMemo, useState } from "react";
import { jalaliISODate } from "../lib/date";
import {
  loadBudgetProfiles,
  loadSupportTickets,
  saveBudgetProfile,
  type BudgetProfile,
  type SupportTicket,
} from "../lib/budgetStore";

const fmt = new Intl.NumberFormat("fa-IR");

function roleLabel(role: BudgetProfile["role"]) {
  return role === "admin" ? "ادمین" : "مشتری";
}

function statusLabel(status: BudgetProfile["status"]) {
  return status === "active" ? "فعال" : "مسدود";
}

export default function CustomersPage() {
  const [profiles, setProfiles] = useState<BudgetProfile[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BudgetProfile | null>(null);

  const refresh = () => {
    setLoading(true);
    Promise.all([loadBudgetProfiles(), loadSupportTickets()])
      .then(([nextProfiles, nextTickets]) => {
        setProfiles(nextProfiles);
        setTickets(nextTickets);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    Promise.all([loadBudgetProfiles(), loadSupportTickets()])
      .then(([nextProfiles, nextTickets]) => {
        if (!active) return;
        setProfiles(nextProfiles);
        setTickets(nextTickets);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const customers = profiles.filter((profile) => profile.role === "customer");
    return {
      total: profiles.length,
      customers: customers.length,
      active: customers.filter((profile) => profile.status === "active").length,
      openTickets: tickets.filter((ticket) => ticket.status === "open" || ticket.status === "in_progress").length,
    };
  }, [profiles, tickets]);

  const ticketCount = (profileId: string) => tickets.filter((ticket) => ticket.customerId === profileId).length;
  const latestTicket = (profileId: string) => tickets.find((ticket) => ticket.customerId === profileId);

  return (
    <div className="space-y-4 pb-6" dir="rtl">
      <div className="sticky top-0 z-30 -mx-8 bg-bg/95 px-8 pb-3 pt-6 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-extrabold text-ink">مدیریت کاربران و مشتریان</div>
            <div className="mt-1 text-xs text-muted">نمای کلی مشتری‌ها، وضعیت دسترسی و سابقه پیام‌ها</div>
          </div>
          <button onClick={refresh} className="rounded-2xl bg-white px-4 py-2 text-xs font-extrabold text-muted ring-1 ring-black/5">
            تازه‌سازی
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric title="کل کاربران" value={counts.total} />
        <Metric title="مشتریان" value={counts.customers} />
        <Metric title="مشتری فعال" value={counts.active} />
        <Metric title="تیکت باز" value={counts.openTickets} />
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="text-sm font-extrabold text-ink">لیست کاربران</div>
        <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-black/5">
          <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.7fr_0.9fr_0.5fr] gap-3 bg-bg px-3 py-2 text-[11px] font-extrabold text-muted">
            <span>کاربر</span>
            <span>نقش</span>
            <span>وضعیت</span>
            <span>تیکت</span>
            <span>آخرین پیام</span>
            <span></span>
          </div>

          {loading ? (
            <div className="px-3 py-4 text-xs text-muted">در حال دریافت...</div>
          ) : profiles.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted">هنوز کاربری ثبت نشده.</div>
          ) : (
            profiles.map((profile) => {
              const latest = latestTicket(profile.id);
              return (
                <div key={profile.id} className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.7fr_0.9fr_0.5fr] items-center gap-3 border-t border-black/5 px-3 py-3 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-extrabold text-ink">{profile.displayName || profile.email || profile.phone || "بدون نام"}</div>
                    <div className="mt-1 truncate text-[11px] text-muted">{profile.email || profile.phone || profile.id}</div>
                  </div>
                  <span className="font-bold text-muted">{roleLabel(profile.role)}</span>
                  <span className={profile.status === "active" ? "font-bold text-emerald-700" : "font-bold text-red-700"}>
                    {statusLabel(profile.status)}
                  </span>
                  <span className="font-extrabold text-ink">{fmt.format(ticketCount(profile.id))}</span>
                  <span className="truncate text-muted">{latest?.createdAt ? jalaliISODate(latest.createdAt.slice(0, 10)) : "-"}</span>
                  <button onClick={() => setEditing(profile)} className="rounded-xl bg-bg px-3 py-2 font-extrabold text-navy-900">
                    ویرایش
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {editing && (
        <CustomerEditModal
          profile={editing}
          onClose={() => setEditing(null)}
          onSave={async (nextProfile) => {
            const saved = await saveBudgetProfile(nextProfile);
            setProfiles((current) => current.map((profile) => (profile.id === saved.id ? saved : profile)));
            setEditing(null);
          }}
        />
      )}
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

function CustomerEditModal({
  profile,
  onClose,
  onSave,
}: {
  profile: BudgetProfile;
  onClose: () => void;
  onSave: (profile: Pick<BudgetProfile, "id" | "displayName" | "status" | "role">) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [status, setStatus] = useState<BudgetProfile["status"]>(profile.status);
  const [role, setRole] = useState<BudgetProfile["role"]>(profile.role);

  return (
    <div className="fixed inset-0 z-50" dir="rtl">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold text-ink">ویرایش کاربر</div>
            <button onClick={onClose} className="h-9 w-9 rounded-xl bg-bg text-muted">×</button>
          </div>
          <div className="mt-4 space-y-3">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full rounded-2xl bg-bg px-4 py-3 text-sm ring-1 ring-black/5 outline-none"
              placeholder="نام نمایشی"
            />
            <select value={role} onChange={(event) => setRole(event.target.value as BudgetProfile["role"])} className="w-full rounded-2xl bg-bg px-4 py-3 text-sm font-bold outline-none">
              <option value="customer">مشتری</option>
              <option value="admin">ادمین</option>
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value as BudgetProfile["status"])} className="w-full rounded-2xl bg-bg px-4 py-3 text-sm font-bold outline-none">
              <option value="active">فعال</option>
              <option value="blocked">مسدود</option>
            </select>
            <button onClick={() => onSave({ id: profile.id, displayName: displayName.trim() || undefined, role, status })} className="w-full rounded-2xl bg-navy-900 px-4 py-3 text-sm font-extrabold text-white">
              ذخیره
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
