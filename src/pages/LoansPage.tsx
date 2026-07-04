import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
import type { Loan, LoanInstallment } from "../layout/Appshell";
import {
  findGregorianForJalali,
  fullJalali,
  jalaliISODate,
  jalaliMonthBounds,
  jalaliParts,
  normalizeDigits,
  parseJalaliISODate,
  shiftJalaliMonth,
  todayISO,
} from "../lib/date";

type Ctx = {
  loans: Loan[];
  loanInstallments: LoanInstallment[];
  deleteLoan: (id: string) => void;
  saveLoanInstallment: (installment: LoanInstallment) => void;
  saveLoanWithInstallments: (loan: Loan, installments: LoanInstallment[]) => void;
  deleteLoanInstallment: (id: string) => void;
};

type PaymentFilter = "unpaid" | "paid";

const money = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.abs(Math.round(value)));
const parseAmount = (value: string) => Number(normalizeDigits(value).replace(/[^\d]/g, "")) || 0;
const formatAmountInput = (value: string) => {
  const amount = parseAmount(value);
  return amount ? new Intl.NumberFormat("en-US").format(amount) : "";
};

function installmentDateAfter(firstDueDate: string, index: number) {
  const first = jalaliParts(firstDueDate);
  const shifted = shiftJalaliMonth(first.year, first.month, index);
  const monthEndDay = jalaliParts(jalaliMonthBounds(shifted.year, shifted.month).end).day;
  return findGregorianForJalali(shifted.year, shifted.month, Math.min(first.day, monthEndDay));
}

function installmentRemaining(installment: LoanInstallment) {
  return Math.max(0, installment.amountToman - (installment.paid ? installment.paidAmountToman ?? installment.amountToman : 0));
}

function installmentStatus(installment: LoanInstallment, today: string) {
  if (installment.paid) return "paid";
  if (installment.dueDate < today) return "late";
  if (installment.dueDate === today) return "due";
  return "future";
}

export default function LoansPage() {
  const {
    loans,
    loanInstallments,
    deleteLoan,
    saveLoanInstallment,
    saveLoanWithInstallments,
    deleteLoanInstallment,
  } = useOutletContext<Ctx>();
  const [selectedLoanId, setSelectedLoanId] = useState(loans[0]?.id ?? "");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("unpaid");
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<LoanInstallment | null>(null);

  const today = todayISO();
  const activeLoans = loans.filter((loan) => loan.active);
  const selectedLoan = loans.find((loan) => loan.id === selectedLoanId) ?? loans[0];
  const installmentsByLoan = useMemo(() => {
    const map = new Map<string, LoanInstallment[]>();
    loans.forEach((loan) => map.set(loan.id, []));
    loanInstallments.forEach((installment) => {
      const rows = map.get(installment.loanId) ?? [];
      rows.push(installment);
      map.set(installment.loanId, rows);
    });
    map.forEach((rows) => rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
    return map;
  }, [loanInstallments, loans]);

  const totals = useMemo(() => {
    const activeIds = new Set(activeLoans.map((loan) => loan.id));
    return loanInstallments
      .filter((installment) => activeIds.has(installment.loanId))
      .reduce(
        (acc, installment) => {
          const remaining = installmentRemaining(installment);
          if (remaining > 0) acc.totalDebt += remaining;
          if (!installment.paid && installment.dueDate <= today) acc.dueDebt += installment.amountToman;
          if (!installment.paid && installment.dueDate < today) acc.lateDebt += installment.amountToman;
          if (installment.paid) acc.paid += installment.paidAmountToman ?? installment.amountToman;
          return acc;
        },
        { totalDebt: 0, dueDebt: 0, lateDebt: 0, paid: 0 }
      );
  }, [activeLoans, loanInstallments, today]);

  const paymentRows = loanInstallments
    .filter((installment) => (paymentFilter === "paid" ? installment.paid : !installment.paid))
    .sort((a, b) => (paymentFilter === "paid" ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate)));
  const selectedInstallments = selectedLoan ? installmentsByLoan.get(selectedLoan.id) ?? [] : [];

  return (
    <div className="space-y-4 pb-4">
      <div className="sticky top-0 z-30 -mx-3 bg-bg/95 px-3 pt-4 pb-3 backdrop-blur sm:-mx-4 sm:px-4 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pt-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold lg:text-xl lg:font-extrabold">تسهیلات</div>
            <div className="mt-1 text-[11px] text-muted">وام‌ها، اقساط، سررسیدها و پرداخت‌ها</div>
          </div>
          <button
            onClick={() => setLoanModalOpen(true)}
            className="rounded-2xl bg-navy-900 px-3 py-2 text-xs font-extrabold text-white shadow-sm active:bg-navy-700"
          >
            تسهیلات جدید
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard title="تسهیلات فعال" value={activeLoans.length} suffix="مورد" />
        <MetricCard title="کل بدهی" value={totals.totalDebt} tone="text-ink" />
        <MetricCard title="سررسید شده" value={totals.dueDebt} tone="text-amber-700" />
        <MetricCard title="دارای تاخیر" value={totals.lateDebt} tone="text-red-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="space-y-4">
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-ink">لیست تسهیلات</div>
              <div className="text-[11px] font-bold text-muted">{money(loans.length)} مورد</div>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {loans.length === 0 ? (
                <div className="rounded-2xl bg-bg px-3 py-4 text-center text-xs text-muted lg:col-span-2">هنوز تسهیلاتی ثبت نشده.</div>
              ) : (
                loans.map((loan) => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    installments={installmentsByLoan.get(loan.id) ?? []}
                    active={selectedLoan?.id === loan.id}
                    today={today}
                    onClick={() => setSelectedLoanId(loan.id)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-ink">جزئیات تسهیلات</div>
                <div className="mt-1 text-[11px] text-muted">{selectedLoan ? selectedLoan.title : "یک تسهیلات انتخاب کن"}</div>
              </div>
              {selectedLoan && (
                <button
                  onClick={() => {
                    if (window.confirm("این تسهیلات و همه اقساطش حذف شود؟")) deleteLoan(selectedLoan.id);
                  }}
                  className="rounded-2xl bg-red-50 px-3 py-2 text-[11px] font-extrabold text-red-700"
                >
                  حذف
                </button>
              )}
            </div>
            {selectedLoan ? (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <InfoTile title="مبلغ دریافتی" value={money(selectedLoan.principalToman)} />
                  <InfoTile title="تاریخ دریافت" value={jalaliISODate(selectedLoan.receivedDate)} />
                </div>
                {selectedLoan.note && <div className="rounded-2xl bg-bg px-3 py-2 text-xs leading-6 text-muted">{selectedLoan.note}</div>}
                <div className="space-y-2">
                  {selectedInstallments.map((installment) => (
                    <InstallmentRow
                      key={installment.id}
                      installment={installment}
                      loanTitle={selectedLoan.title}
                      today={today}
                      onClick={() => setEditingInstallment(installment)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl bg-bg px-3 py-4 text-center text-xs text-muted">اول یک تسهیلات بساز.</div>
            )}
          </div>
        </section>

        <aside className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold text-ink">پرداخت‌ها</div>
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-bg p-1 text-xs">
              <Chip active={paymentFilter === "unpaid"} onClick={() => setPaymentFilter("unpaid")}>انجام نشده</Chip>
              <Chip active={paymentFilter === "paid"} onClick={() => setPaymentFilter("paid")}>انجام شده</Chip>
            </div>
          </div>
          <div className="mt-3 max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {paymentRows.length === 0 ? (
              <div className="rounded-2xl bg-bg px-3 py-4 text-center text-xs text-muted">موردی برای نمایش نیست.</div>
            ) : (
              paymentRows.map((installment) => (
                <InstallmentRow
                  key={installment.id}
                  installment={installment}
                  loanTitle={loans.find((loan) => loan.id === installment.loanId)?.title ?? "تسهیلات"}
                  today={today}
                  compact
                  onClick={() => setEditingInstallment(installment)}
                />
              ))
            )}
          </div>
        </aside>
      </div>

      {loanModalOpen && (
        <LoanModal
          onClose={() => setLoanModalOpen(false)}
          onSubmit={(loan, installments) => {
            saveLoanWithInstallments(loan, installments);
            setSelectedLoanId(loan.id);
            setLoanModalOpen(false);
          }}
        />
      )}

      {editingInstallment && (
        <InstallmentModal
          value={editingInstallment}
          loanTitle={loans.find((loan) => loan.id === editingInstallment.loanId)?.title ?? "تسهیلات"}
          onClose={() => setEditingInstallment(null)}
          onDelete={() => {
            deleteLoanInstallment(editingInstallment.id);
            setEditingInstallment(null);
          }}
          onSubmit={(next) => {
            saveLoanInstallment(next);
            setEditingInstallment(null);
          }}
        />
      )}
    </div>
  );
}

function MetricCard({ title, value, tone = "text-navy-900", suffix }: { title: string; value: number; tone?: string; suffix?: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <div className="text-[11px] text-muted">{title}</div>
      <div className={`mt-1 text-sm font-extrabold ${tone}`}>{money(value)} {suffix ?? ""}</div>
    </div>
  );
}

function InfoTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-bg px-3 py-2">
      <div className="text-[10px] text-muted">{title}</div>
      <div className="mt-1 text-xs font-extrabold text-ink">{value}</div>
    </div>
  );
}

function LoanCard({
  loan,
  installments,
  active,
  today,
  onClick,
}: {
  loan: Loan;
  installments: LoanInstallment[];
  active: boolean;
  today: string;
  onClick: () => void;
}) {
  const unpaid = installments.filter((installment) => !installment.paid);
  const remaining = unpaid.reduce((sum, installment) => sum + installment.amountToman, 0);
  const late = unpaid.filter((installment) => installment.dueDate < today).length;
  const next = unpaid.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-3 py-3 text-right ring-1 transition-colors ${
        active ? "bg-navy-900 text-white ring-navy-900" : "bg-bg text-ink ring-black/5 active:bg-slate-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold">{loan.title}</div>
          <div className={`mt-1 text-[11px] ${active ? "text-white/65" : "text-muted"}`}>
            {loan.lender || "بدون وام‌دهنده"} · دریافت {jalaliISODate(loan.receivedDate)}
          </div>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${late ? "bg-red-50 text-red-700" : active ? "bg-white/10 text-white" : "bg-white text-muted"}`}>
          {late ? `${money(late)} تاخیر` : loan.active ? "فعال" : "غیرفعال"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <span className={active ? "text-white/70" : "text-muted"}>مانده</span>
        <span className="text-left font-extrabold">{money(remaining)}</span>
        <span className={active ? "text-white/70" : "text-muted"}>قسط بعدی</span>
        <span className="text-left font-extrabold">{next ? jalaliISODate(next.dueDate) : "تمام شده"}</span>
      </div>
    </button>
  );
}

function InstallmentRow({
  installment,
  loanTitle,
  today,
  compact,
  onClick,
}: {
  installment: LoanInstallment;
  loanTitle: string;
  today: string;
  compact?: boolean;
  onClick: () => void;
}) {
  const status = installmentStatus(installment, today);
  const statusClass =
    status === "paid"
      ? "bg-emerald-50 text-emerald-700"
      : status === "late"
        ? "bg-red-50 text-red-700"
        : status === "due"
          ? "bg-amber-50 text-amber-700"
          : "bg-bg text-muted";
  const statusLabel = status === "paid" ? "پرداخت شده" : status === "late" ? "با تاخیر" : status === "due" ? "سررسید امروز" : "آینده";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-right ring-1 ring-black/5 ${
        status === "paid" ? "bg-emerald-50/70" : "bg-bg"
      }`}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-ink">{compact ? loanTitle : fullJalali(installment.dueDate)}</div>
        <div className="mt-0.5 truncate text-[11px] text-muted">
          {compact ? jalaliISODate(installment.dueDate) : loanTitle}
          {installment.paidDate ? ` · پرداخت ${jalaliISODate(installment.paidDate)}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-left">
        <div className="text-xs font-extrabold text-ink">{money(installment.paid ? installment.paidAmountToman ?? installment.amountToman : installment.amountToman)}</div>
        <div className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${statusClass}`}>{statusLabel}</div>
      </div>
    </button>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-xl px-2 py-2 font-bold ${active ? "bg-navy-900 text-white" : "text-ink hover:bg-white"}`}>
      {children}
    </button>
  );
}

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-3 top-3 lg:inset-0 lg:grid lg:place-items-center">
        <div className="mx-auto flex h-full max-w-[420px] px-3 sm:px-4 lg:h-auto lg:w-[520px] lg:max-w-none">
          <div className="max-h-full w-full overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/5 lg:max-h-[90vh]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="text-sm font-extrabold text-ink">{title}</div>
      <button onClick={onClose} className="h-9 w-9 rounded-xl bg-bg text-muted" title="بستن" aria-label="بستن">×</button>
    </div>
  );
}

function LoanModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (loan: Loan, installments: LoanInstallment[]) => void }) {
  const [title, setTitle] = useState("");
  const [lender, setLender] = useState("");
  const [principalRaw, setPrincipalRaw] = useState("");
  const [receivedDraft, setReceivedDraft] = useState(jalaliISODate(todayISO()));
  const [countRaw, setCountRaw] = useState("12");
  const [firstDueDraft, setFirstDueDraft] = useState(jalaliISODate(todayISO()));
  const [installmentRaw, setInstallmentRaw] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    const principal = parseAmount(principalRaw);
    const count = Math.max(1, parseAmount(countRaw));
    const receivedDate = parseJalaliISODate(receivedDraft);
    const firstDueDate = parseJalaliISODate(firstDueDraft);
    const installmentAmount = parseAmount(installmentRaw) || Math.round(principal / count);
    if (!title.trim() || !principal || !receivedDate || !firstDueDate || !installmentAmount) return;

    const loanId = `loan_${crypto.randomUUID()}`;
    const loan: Loan = {
      id: loanId,
      title: title.trim(),
      lender: lender.trim() || undefined,
      principalToman: principal,
      receivedDate,
      active: true,
      note: note.trim() || undefined,
    };
    const installments = Array.from({ length: count }, (_, index): LoanInstallment => ({
      id: `installment_${crypto.randomUUID()}`,
      loanId,
      dueDate: installmentDateAfter(firstDueDate, index),
      amountToman: installmentAmount,
      paid: false,
    }));
    onSubmit(loan, installments);
  };

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title="تسهیلات جدید" onClose={onClose} />
      <div className="space-y-3">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان تسهیلات" className="w-full rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none" />
        <input value={lender} onChange={(event) => setLender(event.target.value)} placeholder="وام‌دهنده / بانک" className="w-full rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none" />
        <div className="grid grid-cols-2 gap-2">
          <Field label="مبلغ دریافتی" value={principalRaw} onChange={(value) => setPrincipalRaw(formatAmountInput(value))} ltr />
          <DateField label="تاریخ دریافت" value={receivedDraft} onChange={setReceivedDraft} />
          <Field label="تعداد اقساط" value={countRaw} onChange={(value) => setCountRaw(normalizeDigits(value).replace(/[^\d]/g, ""))} ltr />
          <DateField label="اولین سررسید" value={firstDueDraft} onChange={setFirstDueDraft} />
        </div>
        <Field label="مبلغ هر قسط" value={installmentRaw} onChange={(value) => setInstallmentRaw(formatAmountInput(value))} ltr />
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="توضیح اختیاری" className="w-full rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none" />
        <button onClick={submit} className="w-full rounded-2xl bg-navy-900 px-4 py-3 text-sm font-extrabold text-white">ثبت تسهیلات</button>
      </div>
    </ModalShell>
  );
}

function InstallmentModal({
  value,
  loanTitle,
  onClose,
  onSubmit,
  onDelete,
}: {
  value: LoanInstallment;
  loanTitle: string;
  onClose: () => void;
  onSubmit: (value: LoanInstallment) => void;
  onDelete: () => void;
}) {
  const [amountRaw, setAmountRaw] = useState(new Intl.NumberFormat("en-US").format(value.amountToman));
  const [dueDraft, setDueDraft] = useState(jalaliISODate(value.dueDate));
  const [paid, setPaid] = useState(value.paid);
  const [paidAmountRaw, setPaidAmountRaw] = useState(value.paidAmountToman ? new Intl.NumberFormat("en-US").format(value.paidAmountToman) : "");
  const [paidDateDraft, setPaidDateDraft] = useState(value.paidDate ? jalaliISODate(value.paidDate) : jalaliISODate(todayISO()));
  const [note, setNote] = useState(value.note ?? "");

  const submit = () => {
    const amount = parseAmount(amountRaw);
    const dueDate = parseJalaliISODate(dueDraft);
    const paidDate = (paid ? parseJalaliISODate(paidDateDraft) : undefined) ?? undefined;
    if (!amount || !dueDate || (paid && !paidDate)) return;
    onSubmit({
      ...value,
      amountToman: amount,
      dueDate,
      paid,
      paidAmountToman: paid ? parseAmount(paidAmountRaw) || amount : undefined,
      paidDate,
      note: note.trim() || undefined,
    });
  };

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title={loanTitle} onClose={onClose} />
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="مبلغ قسط" value={amountRaw} onChange={(value) => setAmountRaw(formatAmountInput(value))} ltr />
          <DateField label="تاریخ سررسید" value={dueDraft} onChange={setDueDraft} />
        </div>
        <button
          type="button"
          onClick={() => setPaid((current) => !current)}
          className={`w-full rounded-2xl px-4 py-3 text-sm font-extrabold ${paid ? "bg-emerald-50 text-emerald-700" : "bg-bg text-muted"}`}
        >
          {paid ? "پرداخت شده" : "پرداخت نشده"}
        </button>
        {paid && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="مبلغ پرداختی" value={paidAmountRaw} onChange={(value) => setPaidAmountRaw(formatAmountInput(value))} ltr />
            <DateField label="تاریخ پرداخت" value={paidDateDraft} onChange={setPaidDateDraft} />
          </div>
        )}
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="توضیح اختیاری" className="w-full rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none" />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onDelete} className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-extrabold text-red-700">حذف</button>
          <button onClick={submit} className="rounded-2xl bg-navy-900 px-4 py-3 text-sm font-extrabold text-white">ذخیره</button>
        </div>
      </div>
    </ModalShell>
  );
}

function Field({ label, value, onChange, ltr }: { label: string; value: string; onChange: (value: string) => void; ltr?: boolean }) {
  return (
    <label className="block rounded-2xl bg-bg px-3 py-2">
      <span className="text-[11px] text-muted">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} inputMode="numeric" dir={ltr ? "ltr" : "rtl"} className="mt-1 w-full bg-transparent text-sm font-extrabold text-ink outline-none" />
    </label>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block rounded-2xl bg-bg px-3 py-2">
      <span className="text-[11px] text-muted">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} inputMode="numeric" dir="ltr" className="mt-1 w-full bg-transparent text-sm font-extrabold text-ink outline-none" />
    </label>
  );
}
