import { useMemo, useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { useProjects, useDeductions, useCurrencySettings, useTimeEntries } from "@/lib/hooks";
import { formatMinutesReadable, parseTimeInput } from "@shared/time";
import {
  calcEarnings,
  sumEarnings,
  scaleEarnings,
  WEEKS_PER_MONTH,
  type DeductionRates,
  type Earnings,
} from "@shared/earnings";

const MONO = { fontFamily: "'DM Mono', monospace" };
const SANS = { fontFamily: "'Manrope', sans-serif" };
const DISPLAY = { fontFamily: "'Syne', sans-serif" };
const GREEN = "hsl(155,60%,38%)";

const usd = (n: number) => `$${n.toFixed(2)}`;
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/** H.MM input → minutes. "15" = 15h, "1.30" = 1h 30m. */
function toMinutes(input: string): number {
  if (!input.trim()) return 0;
  const n = Number(input);
  if (!isFinite(n) || n <= 0) return 0;
  return parseTimeInput(input, { format: "hm" }).minutes ?? 0;
}

function useRates(): DeductionRates | null {
  const { data: deductions } = useDeductions();
  if (!deductions) return null;
  return {
    serviceFee: Number(deductions.serviceFee) || 0,
    tds: Number(deductions.tds) || 0,
    gst: Number(deductions.gst) || 0,
  };
}

export function EarningsCalculator() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <motion.button
        onClick={() => setOpen(true)}
        title="Open earnings calculator"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold border border-border/60 bg-card hover:bg-muted/50 transition-colors"
        style={SANS}
      >
        <Calculator className="w-4 h-4" />
        <span className="hidden sm:inline">Calculator</span>
      </motion.button>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 gap-0">
        <div className="px-6 pt-6 pb-4 border-b border-border/60">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "hsl(38,92%,50%)" }}>
                <Calculator className="w-4 h-4" style={{ color: "hsl(228,25%,9%)" }} />
              </div>
              <DialogTitle className="text-lg font-bold" style={DISPLAY}>Earnings Calculator</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground" style={SANS}>
              See what your time is worth after Upwork fees, at today's Upwork rate.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs defaultValue="plan" className="px-6 py-5">
          <TabsList className="grid grid-cols-2 w-full mb-5">
            <TabsTrigger value="plan" data-testid="tab-weekly-plan">Weekly plan</TabsTrigger>
            <TabsTrigger value="single" data-testid="tab-single">Single entry</TabsTrigger>
          </TabsList>
          <TabsContent value="plan"><WeeklyPlan /></TabsContent>
          <TabsContent value="single"><SingleEntry /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Weekly plan ─────────────────────────────────────────────────────────────

interface PlanRow {
  key: string;
  projectId: string | null; // null = a project you're only trying out
  name: string;
  rate: string;
  hours: string; // H.MM per week
}

let rowSeq = 0;
const newKey = () => `row-${++rowSeq}`;

function WeeklyPlan() {
  const { data: projects = [] } = useProjects();
  const { data: currency } = useCurrencySettings();
  const { data: entries = [] } = useTimeEntries();
  const rates = useRates();
  const exchangeRate = Number(currency?.usdToInr) || 0;

  const hourly = projects.filter(p => p.type !== "fixed");
  // Start with one row per hourly project; the plan isn't saved.
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const planRows: PlanRow[] =
    rows ?? hourly.map(p => ({ key: `p-${p.id}`, projectId: p.id, name: p.name, rate: String(p.rate), hours: "" }));

  const update = (key: string, patch: Partial<PlanRow>) =>
    setRows(planRows.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRows(planRows.filter(r => r.key !== key));
  const addExisting = (projectId: string) => {
    const p = projects.find(x => x.id === projectId);
    if (p) setRows([...planRows, { key: newKey(), projectId: p.id, name: p.name, rate: String(p.rate), hours: "" }]);
  };
  const addNew = () => setRows([...planRows, { key: newKey(), projectId: null, name: "", rate: "", hours: "" }]);

  const perRow = planRows.map(r => ({
    row: r,
    earnings: rates ? calcEarnings(toMinutes(r.hours), Number(r.rate) || 0, rates) : null,
  }));
  const week = rates ? sumEarnings(perRow.map(x => x.earnings!)) : null;
  const month = week ? scaleEarnings(week, WEEKS_PER_MONTH) : null;

  // This week so far (Mon–Sun), net of fees, at today's rate like the dashboard.
  const earnedNetUsd = useMemo(() => {
    const now = new Date();
    const interval = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    return entries
      .filter(e => e.date && isWithinInterval(new Date(e.date), interval))
      .reduce((s, e) => s + (Number(e.netUsd) || 0), 0);
  }, [entries]);

  const unused = projects.filter(p => !planRows.some(r => r.projectId === p.id) && p.type !== "fixed");
  const plannedInr = (week?.netUsd ?? 0) * exchangeRate;
  const earnedInr = earnedNetUsd * exchangeRate;
  const pct = plannedInr > 0 ? Math.min(100, (earnedInr / plannedInr) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_80px_90px_90px_28px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" style={MONO}>
          <span>Project</span><span>$/hr</span><span>Hrs / week</span><span className="text-right">Net / week</span><span />
        </div>

        {perRow.map(({ row, earnings }) => (
          <div key={row.key} className="grid grid-cols-[1fr_80px_90px_90px_28px] gap-2 items-center">
            {row.projectId ? (
              <div className="h-9 px-3 rounded-xl border border-border/60 bg-muted/30 flex items-center gap-2 text-sm truncate" style={SANS}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: projects.find(p => p.id === row.projectId)?.color }} />
                <span className="truncate">{row.name}</span>
              </div>
            ) : (
              <Input value={row.name} onChange={e => update(row.key, { name: e.target.value })}
                placeholder="New project name" className="h-9 rounded-xl text-sm" data-testid="input-plan-name" />
            )}
            <Input type="number" inputMode="decimal" min="0" step="0.5" value={row.rate}
              onChange={e => update(row.key, { rate: e.target.value })}
              className="h-9 rounded-xl text-sm" data-testid="input-plan-rate" />
            <Input type="number" inputMode="decimal" min="0" step="0.01" value={row.hours} placeholder="0"
              onChange={e => update(row.key, { hours: e.target.value })}
              className="h-9 rounded-xl text-sm" data-testid="input-plan-hours" />
            <span className="text-right text-sm font-semibold tabular-nums" style={{ ...MONO, color: earnings?.netUsd ? GREEN : undefined }}>
              {earnings?.netUsd ? usd(earnings.netUsd) : "—"}
            </span>
            <button type="button" onClick={() => remove(row.key)} title="Remove"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <div className="flex flex-wrap gap-2 pt-1">
          {unused.length > 0 && (
            <Select value="" onValueChange={addExisting}>
              <SelectTrigger className="h-8 w-auto rounded-xl text-xs gap-1"><Plus className="w-3.5 h-3.5" /><SelectValue placeholder="Add my project" /></SelectTrigger>
              <SelectContent>
                {unused.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (${p.rate}/hr)</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <button type="button" onClick={addNew} data-testid="button-plan-add-new"
            className="h-8 px-3 rounded-xl text-xs font-semibold border border-dashed border-border hover:bg-muted/50 flex items-center gap-1" style={SANS}>
            <Plus className="w-3.5 h-3.5" /> Try a new project
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground" style={SANS}>
          Hours use H.MM: 15 = 15 hrs, 7.30 = 7 hrs 30 min. Rates you change here aren't saved.
        </p>
      </div>

      {week && month && week.minutes > 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4 border-t border-border/60">
          <div className="rounded-xl overflow-hidden border border-border/60">
            <div className="grid grid-cols-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted/40" style={MONO}>
              <span /><span className="text-right">Per week</span><span className="text-right">Per month</span>
            </div>
            <PlanLine label="Hours" week={formatMinutesReadable(Math.round(week.minutes))} month={formatMinutesReadable(Math.round(month.minutes))} />
            <PlanLine label="Gross" week={usd(week.grossUsd)} month={usd(month.grossUsd)} />
            <PlanLine label={`Upwork fees, GST & TDS`} week={`−${usd(week.deductions)}`} month={`−${usd(month.deductions)}`} negative />
            <PlanLine label="Net (USD)" week={usd(week.netUsd)} month={usd(month.netUsd)} strong />
            <PlanLine label="Net (INR)" week={inr(week.netUsd * exchangeRate)} month={inr(month.netUsd * exchangeRate)} strong green />
          </div>
          <p className="text-[10px] text-center text-muted-foreground" style={MONO}>
            At Upwork rate ₹{exchangeRate.toFixed(2)}/$ · month = week × {WEEKS_PER_MONTH.toFixed(2)} (52 weeks ÷ 12)
          </p>

          <div className="rounded-xl p-4 space-y-2" style={{ background: "hsl(155,60%,38%,0.06)", border: "1px solid hsl(155,60%,38%,0.2)" }}>
            <div className="flex justify-between text-xs" style={SANS}>
              <span className="font-semibold">This week so far</span>
              <span className="tabular-nums" style={MONO}>{pct.toFixed(0)}%</span>
            </div>
            <Progress value={pct} className="h-2" />
            <div className="grid grid-cols-3 text-center pt-1">
              <Stat label="Planned" value={inr(plannedInr)} />
              <Stat label="Earned" value={inr(earnedInr)} />
              <Stat label={earnedInr >= plannedInr ? "Ahead by" : "To go"} value={inr(Math.abs(plannedInr - earnedInr))} />
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="py-6 text-center text-muted-foreground">
          <Calculator className="w-8 h-8 mx-auto mb-3 opacity-20" />
          <p className="text-sm" style={SANS}>Enter the hours you plan to give each project this week.</p>
        </div>
      )}
    </div>
  );
}

function PlanLine({ label, week, month, strong, negative, green }: {
  label: string; week: string; month: string; strong?: boolean; negative?: boolean; green?: boolean;
}) {
  const color = negative ? "hsl(0,72%,51%)" : green ? GREEN : undefined;
  return (
    <div className="grid grid-cols-3 px-4 py-2.5 border-t border-border/40 items-center">
      <span className={strong ? "text-xs font-bold" : "text-xs text-muted-foreground"} style={SANS}>{label}</span>
      <span className={`text-right tabular-nums ${strong ? "text-sm font-bold" : "text-xs font-semibold"}`} style={{ ...MONO, color }}>{week}</span>
      <span className={`text-right tabular-nums ${strong ? "text-sm font-bold" : "text-xs font-semibold"}`} style={{ ...MONO, color }}>{month}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground" style={MONO}>{label}</p>
      <p className="text-sm font-bold tabular-nums" style={DISPLAY}>{value}</p>
    </div>
  );
}

// ── Single entry ────────────────────────────────────────────────────────────

function SingleEntry() {
  const [timeInput, setTimeInput] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const { data: projects = [] } = useProjects();
  const { data: deductions } = useDeductions();
  const { data: currency } = useCurrencySettings();
  const rates = useRates();

  const project = projects.find(p => p.id === selectedProjectId);
  const minutes = toMinutes(timeInput);
  const exchangeRate = Number(currency?.usdToInr) || 0;
  const result: Earnings | null =
    project && rates && minutes > 0 ? calcEarnings(minutes, Number(project.rate) || 0, rates) : null;

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={MONO}>Hours Worked</p>
          <Input type="number" placeholder="1.30" value={timeInput} onChange={e => setTimeInput(e.target.value)}
            min="0" step="0.01" inputMode="decimal" className="h-10 rounded-xl text-base" data-testid="input-calc-hours" />
          <p className="text-xs text-muted-foreground" style={SANS}>1.30 = 1 hr 30 min · 2.45 = 2 hr 45 min · 0.30 = 30 min</p>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={MONO}>Project</p>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select a project" /></SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                    {p.name} {p.type === "fixed" ? "(Fixed)" : `($${p.rate}/hr)`}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {result && project ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="space-y-4 pt-4 border-t border-border/60">
          <div className="rounded-xl p-3 text-center" style={{ background: "hsl(220,15%,97%)", border: "1px solid hsl(220,15%,90%)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1" style={MONO}>Time · Billing</p>
            <p className="text-base font-bold" style={DISPLAY}>{formatMinutesReadable(minutes)}</p>
            <p className="text-xs text-muted-foreground mt-0.5" style={SANS}>
              {(minutes / 60).toFixed(2)} hrs × ${project.rate}/hr = {usd(result.grossUsd)} gross
            </p>
          </div>

          <div className="rounded-xl overflow-hidden border border-border/60">
            {[
              { label: `Service Fee (${deductions?.serviceFee}%)`, value: result.serviceFee },
              { label: `TDS (${deductions?.tds}%)`, value: result.tds },
              { label: `GST (${deductions?.gst}% on service fee)`, value: result.gst },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center px-4 py-2.5 border-b border-border/40"
                style={{ background: i % 2 === 0 ? "hsl(220,15%,98%)" : "white" }}>
                <span className="text-xs text-muted-foreground" style={SANS}>{item.label}</span>
                <span className="text-xs font-semibold tabular-nums text-destructive" style={MONO}>−{usd(item.value)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center px-4 py-3" style={{ background: "hsl(220,15%,95%)" }}>
              <span className="text-xs font-bold" style={SANS}>Total Deductions</span>
              <span className="text-sm font-bold tabular-nums text-destructive" style={MONO}>−{usd(result.deductions)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4" style={{ background: "hsl(155,60%,38%,0.08)", border: "1px solid hsl(155,60%,38%,0.2)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1" style={MONO}>Net USD</p>
              <p className="text-2xl font-bold tabular-nums" style={{ ...DISPLAY, color: GREEN }}>{usd(result.netUsd)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "hsl(155,60%,38%,0.08)", border: "1px solid hsl(155,60%,38%,0.2)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1" style={MONO}>Net INR</p>
              <p className="text-2xl font-bold tabular-nums" style={{ ...DISPLAY, color: GREEN }}>{inr(result.netUsd * exchangeRate)}</p>
            </div>
          </div>
          <p className="text-[10px] text-center text-muted-foreground" style={MONO}>Upwork rate: 1 USD = ₹{exchangeRate.toFixed(2)}</p>
        </motion.div>
      ) : (
        <div className="py-8 text-center text-muted-foreground">
          <Calculator className="w-8 h-8 mx-auto mb-3 opacity-20" />
          <p className="text-sm" style={SANS}>Enter time (H.MM format) and select a project to see calculations</p>
        </div>
      )}
    </div>
  );
}
