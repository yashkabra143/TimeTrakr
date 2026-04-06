import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ProGate } from "@/components/pro-gate";
import { UpgradeModal } from "@/components/upgrade-modal";
import { useToast } from "@/hooks/use-toast";
import { useIsPro } from "@/lib/hooks";
import { downloadTaxPDF, type TaxReportData } from "@/components/tax-pdf-report";
import {
  Calculator, Receipt, FileText, Plus, Trash2, Printer,
  TrendingUp, AlertCircle, CheckCircle2, Clock, ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

function getFY(date: Date) {
  const m = date.getMonth(); // 0-based
  const y = date.getFullYear();
  return m >= 3 ? { start: y, end: y + 1 } : { start: y - 1, end: y };
}

function fyLabel(fy: { start: number; end: number }) {
  return `FY ${fy.start}-${String(fy.end).slice(2)}`;
}

function fyRange(fy: { start: number; end: number }) {
  return {
    from: new Date(fy.start, 3, 1),   // April 1
    to: new Date(fy.end, 2, 31, 23, 59, 59), // March 31
  };
}

function inFY(date: Date, fy: { start: number; end: number }) {
  const { from, to } = fyRange(fy);
  return date >= from && date <= to;
}

function quarterOfDate(date: Date, fy: { start: number; end: number }) {
  const m = date.getMonth();
  // Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar
  if (m >= 3 && m <= 5) return `Q1 ${fyLabel(fy)}`;
  if (m >= 6 && m <= 8) return `Q2 ${fyLabel(fy)}`;
  if (m >= 9 && m <= 11) return `Q3 ${fyLabel(fy)}`;
  return `Q4 ${fyLabel(fy)}`;
}

const ADVANCE_TAX_INSTALLMENTS = [
  { label: "1st Installment", dueMonth: 5, dueDay: 15, cumPct: 15 },  // Jun 15
  { label: "2nd Installment", dueMonth: 8, dueDay: 15, cumPct: 45 },  // Sep 15
  { label: "3rd Installment", dueMonth: 11, dueDay: 15, cumPct: 75 }, // Dec 15
  { label: "4th Installment", dueMonth: 2, dueDay: 15, cumPct: 100 }, // Mar 15
];

function fmt(n: number, currency = "₹") {
  return `${currency}${Math.round(n).toLocaleString("en-IN")}`;
}

function apiRequest(method: string, url: string, body?: unknown) {
  return fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => (r.status === 204 ? null : r.json()));
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "amber" }: { label: string; value: string; sub?: string; color?: "amber" | "green" | "red" | "blue" }) {
  const colors = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };
  return (
    <div className={cn("rounded-2xl border p-5", colors[color])}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-amber-600" />
      </div>
      <div>
        <h2 className="text-base font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TaxPage() {
  const today = new Date();
  const currentFY = getFY(today);
  const [fy, setFY] = useState(currentFY);
  const [showTdsForm, setShowTdsForm] = useState(false);
  const [tdsForm, setTdsForm] = useState({ deductorName: "", panNumber: "", amount: "", grossAmount: "", certificateNumber: "", date: "", quarter: "" });
  const [showUpgradeForPdf, setShowUpgradeForPdf] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const isPro = useIsPro();

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: entries = [] } = useQuery<any[]>({ queryKey: ["/api/entries"], queryFn: () => apiRequest("GET", "/api/entries") });
  const { data: deductions } = useQuery<any>({ queryKey: ["/api/deductions"], queryFn: () => apiRequest("GET", "/api/deductions") });
  const { data: tdsEntries = [] } = useQuery<any[]>({ queryKey: ["/api/tds-entries"], queryFn: () => apiRequest("GET", "/api/tds-entries") });

  const deleteTds = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/tds-entries/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tds-entries"] }); toast({ title: "TDS entry deleted" }); },
  });

  const addTds = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/tds-entries", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tds-entries"] });
      toast({ title: "TDS entry added" });
      setShowTdsForm(false);
      setTdsForm({ deductorName: "", panNumber: "", amount: "", grossAmount: "", certificateNumber: "", date: "", quarter: "" });
    },
    onError: () => toast({ title: "Failed to add entry", variant: "destructive" }),
  });

  // ── Computations ──────────────────────────────────────────────────────────
  const fyEntries = useMemo(() => entries.filter((e) => inFY(new Date(e.date), fy)), [entries, fy]);

  const totals = useMemo(() => {
    const grossUsd = fyEntries.reduce((s, e) => s + (e.grossUsd ?? 0), 0);
    const netUsd = fyEntries.reduce((s, e) => s + (e.netUsd ?? 0), 0);
    const netInr = fyEntries.reduce((s, e) => s + (e.netInr ?? 0), 0);
    const platformTdsInr = fyEntries.reduce((s, e) => s + (e.deductionTds ?? 0) * (e.exchangeRate ?? 0), 0);
    const gstPaidInr = fyEntries.reduce((s, e) => s + (e.deductionGst ?? 0) * (e.exchangeRate ?? 0), 0);
    return { grossUsd, netUsd, netInr, platformTdsInr, gstPaidInr };
  }, [fyEntries]);

  const taxSlabRate = deductions?.taxSlabRate ?? 30;
  const isGstRegistered = deductions?.isGstRegistered ?? false;

  // Advance tax: project annual income from YTD
  const { fromDate } = useMemo(() => ({ fromDate: fyRange(fy).from }), [fy]);
  const monthsElapsed = Math.max(1, (today.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  const projectedAnnualInr = (totals.netInr / monthsElapsed) * 12;
  const estimatedTax = projectedAnnualInr * (taxSlabRate / 100);

  // Quarterly GST (platform GST paid = ITC)
  const quarterlyGst = useMemo(() => {
    const map: Record<string, number> = {};
    fyEntries.forEach((e) => {
      const q = quarterOfDate(new Date(e.date), fy);
      map[q] = (map[q] ?? 0) + (e.deductionGst ?? 0) * (e.exchangeRate ?? 0);
    });
    return map;
  }, [fyEntries, fy]);

  // Indian client TDS (from manual entries, filtered by FY)
  const fyTdsEntries = useMemo(
    () => tdsEntries.filter((e) => inFY(new Date(e.date), fy)),
    [tdsEntries, fy]
  );
  const indianTdsTotal = fyTdsEntries.reduce((s, e) => s + (e.amount ?? 0), 0);

  // Advance tax installment due dates (relative to chosen FY)
  const installments = useMemo(() => {
    return ADVANCE_TAX_INSTALLMENTS.map((inst, i) => {
      const prevCum = i === 0 ? 0 : ADVANCE_TAX_INSTALLMENTS[i - 1].cumPct;
      const payNow = ((inst.cumPct - prevCum) / 100) * estimatedTax;
      const cumPay = (inst.cumPct / 100) * estimatedTax;
      // Due date year: Q4 uses fy.end year, others use fy.start year
      const dueYear = inst.dueMonth === 2 ? fy.end : fy.start;
      const dueDate = new Date(dueYear, inst.dueMonth, inst.dueDay);
      const isPast = today > dueDate;
      const isNext = !isPast && ADVANCE_TAX_INSTALLMENTS.slice(0, i).every((prev) => {
        const prevYear = prev.dueMonth === 2 ? fy.end : fy.start;
        return today > new Date(prevYear, prev.dueMonth, prev.dueDay);
      });
      return { ...inst, payNow, cumPay, dueDate, isPast, isNext };
    });
  }, [estimatedTax, fy, today]);

  const availableFYs = [currentFY, { start: currentFY.start - 1, end: currentFY.end - 1 }];

  function handleAddTds(e: React.FormEvent) {
    e.preventDefault();
    if (!tdsForm.deductorName || !tdsForm.amount || !tdsForm.grossAmount || !tdsForm.date || !tdsForm.quarter) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }
    addTds.mutate({
      deductorName: tdsForm.deductorName,
      panNumber: tdsForm.panNumber || null,
      amount: Number(tdsForm.amount),
      grossAmount: Number(tdsForm.grossAmount),
      certificateNumber: tdsForm.certificateNumber || null,
      quarter: tdsForm.quarter,
      date: tdsForm.date,
    });
  }

  async function handleExportPdf() {
    if (!isPro) {
      setShowUpgradeForPdf(true);
      return;
    }
    setIsExporting(true);
    try {
      const reportData: TaxReportData = {
        fy: fyLabel(fy),
        generatedDate: today.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        grossUsd: totals.grossUsd,
        netUsd: totals.netUsd,
        netInr: totals.netInr,
        platformTdsInr: totals.platformTdsInr,
        gstPaidInr: totals.gstPaidInr,
        taxSlabRate,
        estimatedTax,
        projectedAnnualInr,
        installments: installments.map(inst => ({
          label: inst.label,
          dueDate: inst.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
          cumPct: inst.cumPct,
          payNow: inst.payNow,
          isPast: inst.isPast,
        })),
        isGstRegistered,
        quarterlyGst,
        indianTdsTotal,
        totalTdsCredit: totals.platformTdsInr + indianTdsTotal,
        tdsEntries: fyTdsEntries.map((e: any) => ({
          deductorName: e.deductorName,
          amount: e.amount,
          grossAmount: e.grossAmount,
          quarter: e.quarter,
          panNumber: e.panNumber ?? null,
          certificateNumber: e.certificateNumber ?? null,
        })),
      };
      await downloadTaxPDF(reportData);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Print-only header */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold">TimeTrakr — CA-Ready Tax Summary</h1>
        <p className="text-sm text-gray-500">{fyLabel(fy)} · Generated {today.toLocaleDateString("en-IN")}</p>
      </div>

      <div className="space-y-8 print:space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-1" style={{ fontFamily: "'DM Mono', monospace" }}>
              Tax Intelligence
            </p>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              Tax Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Advance tax, GST & TDS — all in one place
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* FY Selector */}
            <div className="relative">
              <select
                value={`${fy.start}-${fy.end}`}
                onChange={(e) => {
                  const [s, en] = e.target.value.split("-").map(Number);
                  setFY({ start: s, end: en });
                }}
                className="h-9 pl-3 pr-8 rounded-xl border border-border text-sm font-semibold appearance-none bg-background cursor-pointer"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                {availableFYs.map((f) => (
                  <option key={f.start} value={`${f.start}-${f.end}`}>{fyLabel(f)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>

            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-amber-500 text-amber-950 text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              <Printer className="w-3.5 h-3.5" />
              {isExporting ? "Generating..." : "Export PDF"}
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Net Earned" value={fmt(totals.netInr)} sub={`${fyEntries.length} entries`} color="amber" />
          <StatCard label="Est. Tax Liability" value={fmt(estimatedTax)} sub={`${taxSlabRate}% slab`} color="red" />
          <StatCard label="TDS Credit (Platform)" value={fmt(totals.platformTdsInr)} sub="claimable" color="green" />
          <StatCard label="GST Paid (ITC)" value={fmt(totals.gstPaidInr)} sub="input credit" color="blue" />
        </div>

        {/* ── Advance Tax Scheduler ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <SectionHeader
            icon={Calculator}
            title="Advance Tax Scheduler"
            subtitle={`Based on ${fmt(totals.netInr)} earned so far → projected ${fmt(projectedAnnualInr)}/year → ${taxSlabRate}% slab`}
          />

          <div className="space-y-3">
            {installments.map((inst) => (
              <div
                key={inst.label}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border transition-all",
                  inst.isNext
                    ? "border-amber-300 bg-amber-50"
                    : inst.isPast
                    ? "border-border bg-muted/30 opacity-70"
                    : "border-border bg-background"
                )}
              >
                <div className="shrink-0">
                  {inst.isPast ? (
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                  ) : inst.isNext ? (
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-muted-foreground/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>{inst.label}</span>
                    {inst.isNext && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-amber-950">
                        Due Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Due: {inst.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · Cumulative {inst.cumPct}%
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-base font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(inst.payNow)}</p>
                  <p className="text-[11px] text-muted-foreground">pay this installment</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground mt-4 italic">
            * Estimates only. Consult a CA for actual tax liability. Based on projected annual income at current pace.
          </p>
        </motion.div>

        {/* ── GST Tracker ──────────────────────────────────────────────── */}
        <ProGate mode="blur" featureName="GST Tracker">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-card rounded-2xl border border-border p-6"
          >
            <SectionHeader
              icon={TrendingUp}
              title="GST Tracker"
              subtitle={isGstRegistered ? "GST paid on platform fees (Input Tax Credit available)" : "Enable GST registration in Settings → Financials to track ITC"}
            />

            {!isGstRegistered ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border/60">
                <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  GST registration not enabled. Go to <strong>Settings → Financials</strong> and toggle "GST Registered" to track quarterly ITC.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {["Q1", "Q2", "Q3", "Q4"].map((q) => {
                  const key = `${q} ${fyLabel(fy)}`;
                  const amt = quarterlyGst[key] ?? 0;
                  return (
                    <div key={q} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
                      <div>
                        <p className="text-sm font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>{key}</p>
                        <p className="text-[11px] text-muted-foreground">GST paid on platform fees (18%) — ITC claimable in GSTR-3B</p>
                      </div>
                      <p className="text-base font-bold text-blue-600" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(amt)}</p>
                    </div>
                  );
                })}
                <p className="text-[11px] text-muted-foreground mt-2 italic">
                  * Upwork export income is zero-rated (0% GST). The amounts above are GST paid TO Upwork on their service fees — claimable as Input Tax Credit.
                </p>
              </div>
            )}
          </motion.div>
        </ProGate>

        {/* ── TDS Summary ───────────────────────────────────────────────── */}
        <ProGate mode="blur" featureName="TDS Reconciliation">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-card rounded-2xl border border-border p-6"
          >
          <SectionHeader
            icon={Receipt}
            title="TDS Summary"
            subtitle="Platform TDS (auto-calculated) + Indian client TDS certificates"
          />

          {/* Platform TDS */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/20 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>Platform / Marketplace TDS</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Withheld from your earnings (auto-calculated from entries)</p>
              </div>
              <p className="text-lg font-bold text-green-600" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(totals.platformTdsInr)}</p>
            </div>
          </div>

          {/* Indian client TDS */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Indian Client TDS (Sec 194J) — {fmt(indianTdsTotal)} total
            </p>
            <button
              onClick={() => setShowTdsForm(!showTdsForm)}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Certificate
            </button>
          </div>

          {/* Add form */}
          {showTdsForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              onSubmit={handleAddTds}
              className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">New TDS Certificate</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Deductor Name *</label>
                  <Input placeholder="Client / Company name" value={tdsForm.deductorName} onChange={(e) => setTdsForm({ ...tdsForm, deductorName: e.target.value })} className="h-9 text-sm rounded-xl" required />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">TDS Amount (₹) *</label>
                  <Input type="number" placeholder="e.g. 5000" value={tdsForm.amount} onChange={(e) => setTdsForm({ ...tdsForm, amount: e.target.value })} className="h-9 text-sm rounded-xl" required />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Gross Invoice (₹) *</label>
                  <Input type="number" placeholder="e.g. 50000" value={tdsForm.grossAmount} onChange={(e) => setTdsForm({ ...tdsForm, grossAmount: e.target.value })} className="h-9 text-sm rounded-xl" required />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Quarter *</label>
                  <select
                    value={(tdsForm as any).quarter ?? ""}
                    onChange={(e) => setTdsForm({ ...tdsForm, ...{ quarter: e.target.value } } as any)}
                    className="w-full h-9 px-3 rounded-xl border border-input text-sm bg-background"
                    required
                  >
                    <option value="">Select quarter</option>
                    {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                      <option key={q} value={`${q} ${fyLabel(fy)}`}>{`${q} ${fyLabel(fy)}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Date *</label>
                  <Input type="date" value={tdsForm.date} onChange={(e) => setTdsForm({ ...tdsForm, date: e.target.value })} className="h-9 text-sm rounded-xl" required />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">PAN</label>
                  <Input placeholder="Deductor PAN" value={tdsForm.panNumber} onChange={(e) => setTdsForm({ ...tdsForm, panNumber: e.target.value })} className="h-9 text-sm rounded-xl" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Certificate No.</label>
                  <Input placeholder="TDS cert number" value={tdsForm.certificateNumber} onChange={(e) => setTdsForm({ ...tdsForm, certificateNumber: e.target.value })} className="h-9 text-sm rounded-xl" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={addTds.isPending} className="px-4 py-2 rounded-xl bg-amber-500 text-amber-950 text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50">
                  {addTds.isPending ? "Saving…" : "Add Entry"}
                </button>
                <button type="button" onClick={() => setShowTdsForm(false)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted/50 transition-colors">
                  Cancel
                </button>
              </div>
            </motion.form>
          )}

          {fyTdsEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No Indian client TDS certificates for {fyLabel(fy)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fyTdsEntries.map((entry: any) => (
                <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-background">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>{entry.deductorName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {entry.quarter} · {entry.panNumber ?? "No PAN"} · {entry.certificateNumber ?? "No cert#"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-green-600 shrink-0" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(entry.amount)}</p>
                  <button onClick={() => deleteTds.mutate(entry.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Total TDS credit */}
          <div className="mt-4 p-3 rounded-xl border border-green-200 bg-green-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-green-700">Total TDS Credit ({fyLabel(fy)})</p>
            <p className="text-lg font-bold text-green-700" style={{ fontFamily: "'DM Mono', monospace" }}>
              {fmt(totals.platformTdsInr + indianTdsTotal)}
            </p>
          </div>
          </motion.div>
        </ProGate>

        {/* ── CA Export Preview ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <SectionHeader
            icon={FileText}
            title="CA-Ready Summary"
            subtitle={`${fyLabel(fy)} · Hand this to your CA`}
          />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>Item</th>
                  <th className="text-right py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {[
                  { label: "Gross Earnings (USD)", value: `$${Math.round(totals.grossUsd).toLocaleString()}` },
                  { label: "Net Earnings (USD, after deductions)", value: `$${Math.round(totals.netUsd).toLocaleString()}` },
                  { label: "Net Earnings (INR)", value: fmt(totals.netInr) },
                  { label: "Platform Service Fee (deducted)", value: fmt(fyEntries.reduce((s, e) => s + (e.deductionService ?? 0) * (e.exchangeRate ?? 0), 0)) },
                  { label: "GST on Platform Fee (ITC available)", value: fmt(totals.gstPaidInr) },
                  { label: "Platform TDS (26AS credit)", value: fmt(totals.platformTdsInr) },
                  { label: "Indian Client TDS (Sec 194J)", value: fmt(indianTdsTotal) },
                  { label: "Total TDS Credit", value: fmt(totals.platformTdsInr + indianTdsTotal), bold: true },
                  { label: `Estimated Income Tax Liability (${taxSlabRate}% slab)`, value: fmt(estimatedTax), bold: true, red: true },
                  { label: "Projected Net Tax Payable (after TDS credit)", value: fmt(Math.max(0, estimatedTax - totals.platformTdsInr - indianTdsTotal)), bold: true, red: true },
                ].map((row, i) => (
                  <tr key={i}>
                    <td className={cn("py-2.5 pr-4", row.bold && "font-semibold")}>{row.label}</td>
                    <td className={cn("py-2.5 text-right font-mono", row.bold && "font-bold", row.red && "text-red-600")}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-muted-foreground mt-4 italic">
            * Tax estimates only. Not professional tax advice. Verify with a CA before filing.
          </p>

          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="mt-4 flex items-center gap-2 h-9 px-4 rounded-xl bg-amber-500 text-amber-950 text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 print:hidden"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <Printer className="w-3.5 h-3.5" />
            {isExporting ? "Generating..." : "Export PDF"}
          </button>
        </motion.div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          main > div { visibility: visible; position: absolute; top: 0; left: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
          button { display: none !important; }
        }
      `}</style>

      <UpgradeModal open={showUpgradeForPdf} onOpenChange={setShowUpgradeForPdf} featureName="PDF Export" />
    </>
  );
}
