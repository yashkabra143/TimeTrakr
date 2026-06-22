import * as React from "react";
import { motion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/lib/animations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Clock,
  DollarSign,
  Wallet,
  PieChart as PieChartIcon,
  Edit2,
  Trash2,
  Plus,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  startOfYear,
  isWithinInterval,
  subDays,
  subWeeks,
  parseISO,
} from "date-fns";
import { EntryForm } from "@/components/entry-form";
import { formatMinutesReadable, minutesToHoursDecimal } from "@shared/time";
import { useTimeEntries, useProjects, useCurrencySettings } from "@/lib/hooks";
import { AnimatedEmptyState } from "@/components/animated-empty-state";
import { cn } from "@/lib/utils";
import { CalendarIcon, X } from "lucide-react";

// ── Animation variants ───────────────────────────────────────────────────────
const fade = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.45, delay: i * 0.07, ease: EASE_OUT_EXPO } }),
};

const RANGES = [
  { value: "week",      label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "month",     label: "This Month" },
  { value: "last30",    label: "Last 30 Days" },
  { value: "last90",    label: "Last 90 Days" },
  { value: "year",      label: "This Year" },
  { value: "all",       label: "All Time" },
  { value: "custom",    label: "Custom" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Inline stats card ────────────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accent?: string;   // tailwind bg class for icon bg
  iconColor?: string;
  custom?: number;
}

function StatCard({ title, value, sub, icon: Icon, accent = "bg-primary/10", iconColor = "text-primary", custom = 0 }: StatCardProps) {
  return (
    <motion.div
      variants={fade}
      custom={custom}
      initial="hidden"
      animate="show"
      className="bg-card border border-border/60 rounded-2xl p-5 relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
          {title}
        </p>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", accent)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "'Manrope', sans-serif" }}>{sub}</p>
      {/* Ambient glow */}
      <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
    </motion.div>
  );
}

// ── Chart tooltip style ──────────────────────────────────────────────────────
const tooltipStyle = {
  borderRadius: "10px",
  border: "1px solid hsl(220,15%,88%)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  backgroundColor: "hsl(0,0%,100%)",
  color: "hsl(230,25%,12%)",
  fontFamily: "'Manrope', sans-serif",
  fontSize: "12px",
};

export default function Dashboard() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const { data: currency } = useCurrencySettings();
  const [dateRange, setDateRange] = React.useState("week");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [editingEntryId, setEditingEntryId] = React.useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = React.useState<string | null>(null);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);

  const currentInterval = React.useMemo(() => {
    switch (dateRange) {
      case "week":      return { start: weekStart,              end: weekEnd };
      case "last_week": return { start: lastWeekStart,          end: lastWeekEnd };
      case "month":     return { start: monthStart,             end: today };
      case "last30":    return { start: subDays(today, 30),     end: today };
      case "last90":    return { start: subDays(today, 90),     end: today };
      case "year":      return { start: startOfYear(today),     end: today };
      case "all":       return { start: new Date(0),            end: today };
      case "custom":    return {
        start: customFrom ? parseISO(customFrom) : subDays(today, 30),
        end:   customTo   ? parseISO(customTo)   : today,
      };
      default:          return { start: weekStart, end: weekEnd };
    }
  }, [dateRange, today, customFrom, customTo]);

  const filteredEntries = React.useMemo(() =>
    entries.filter(e => {
      if (!e.date) return false;
      return isWithinInterval(new Date(e.date), currentInterval);
    }),
    [entries, currentInterval]
  );

  const summary = React.useMemo(() =>
    filteredEntries.reduce(
      (acc, curr) => ({
        minutes:    acc.minutes    + (curr.minutes       || 0),
        grossUsd:   acc.grossUsd   + (curr.grossUsd      || 0),
        netUsd:     acc.netUsd     + (curr.netUsd        || 0),
        netInr:     acc.netInr     + (curr.netInr        || 0),
        deductions: acc.deductions + (curr.deductionTotal || 0),
      }),
      { minutes: 0, grossUsd: 0, netUsd: 0, netInr: 0, deductions: 0 }
    ),
    [filteredEntries]
  );

  const lineChartData = React.useMemo(() => {
    let start = currentInterval.start;
    const end = currentInterval.end;
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    if (daysDiff > 31) start = subDays(end, 30);

    const days: Date[] = [];
    let curr = start;
    while (curr <= end && days.length < 365) {
      days.push(curr);
      curr = new Date(curr.getTime() + 86400000);
    }

    return days.map(date => {
      const dayEntries = filteredEntries.filter(
        e => e.date && format(new Date(e.date), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
      );
      return {
        name: format(date, "MMM dd"),
        hours: minutesToHoursDecimal(dayEntries.reduce((a, e) => a + (e.minutes || 0), 0)),
      };
    });
  }, [filteredEntries, currentInterval]);

  const chartStats = React.useMemo(() => {
    if (!lineChartData.length) return { min: "0.0", max: "0.0", avg: "0.0" };
    const h = lineChartData.map(d => d.hours);
    return {
      min: Math.min(...h).toFixed(1),
      max: Math.max(...h).toFixed(1),
      avg: (h.reduce((a, b) => a + b, 0) / h.length).toFixed(1),
    };
  }, [lineChartData]);

  const projectPieData = React.useMemo(() =>
    projects.map(p => ({
      name: p.name,
      value: filteredEntries
        .filter(e => e.projectId === p.id)
        .reduce((acc, e) => acc + minutesToHoursDecimal(e.minutes || 0), 0),
      color: p.color,
    })).filter(d => d.value > 0),
    [filteredEntries, projects]
  );

  const rangeLabel = RANGES.find(r => r.value === dateRange)?.label ?? "This Week";

  return (
    <div className="space-y-7 pb-8">

      {/* ── Header ──────────────────────────────────────────────── */}
      <motion.div
        variants={fade} custom={0} initial="hidden" animate="show"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-1" style={{ fontFamily: "'DM Mono', monospace" }}>
            Overview
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            {greeting()}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Here's your productivity snapshot.
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: "0 6px 24px hsl(38,92%,50%,0.35)" }}
              whileTap={{ scale: 0.97 }}
              data-testid="button-log-hours"
              className="flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-semibold shrink-0"
              style={{
                background: "hsl(38,92%,50%)",
                color: "hsl(228,25%,9%)",
                fontFamily: "'Manrope', sans-serif",
                boxShadow: "0 4px 16px hsl(38,92%,50%,0.25)",
              }}
            >
              <Plus className="w-4 h-4" />
              Log Hours
            </motion.button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Quick Log</DialogTitle>
              <DialogDescription>Add a new time entry. It will be added to your weekly summary.</DialogDescription>
            </DialogHeader>
            <EntryForm onSuccess={() => {
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
            }} />
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* ── Range tabs ──────────────────────────────────────────── */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show" className="space-y-3">
        <div
          className="flex flex-wrap gap-1 p-1 rounded-xl border border-border/60 w-fit"
          style={{ background: "hsl(220,15%,95%)" }}
        >
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setDateRange(r.value)}
              className={cn(
                "px-3 h-8 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5",
                dateRange === r.value
                  ? "text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              style={{
                background: dateRange === r.value ? "white" : "transparent",
                fontFamily: "'Manrope', sans-serif",
                boxShadow: dateRange === r.value ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {r.value === "custom" && <CalendarIcon className="w-3 h-3" />}
              {r.label}
            </button>
          ))}
        </div>

        {/* Custom date picker */}
        {dateRange === "custom" && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap items-center gap-2"
          >
            <div className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-card">
              <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="text-xs border-none outline-none bg-transparent text-foreground"
                style={{ fontFamily: "'DM Mono', monospace" }}
              />
              <span className="text-muted-foreground text-xs">→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="text-xs border-none outline-none bg-transparent text-foreground"
                style={{ fontFamily: "'DM Mono', monospace" }}
              />
            </div>
            {(customFrom || customTo) && (
              <button
                onClick={() => { setCustomFrom(""); setCustomTo(""); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* ── Stats grid ──────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Hours"
          value={formatMinutesReadable(summary.minutes)}
          sub={`Hours logged ${dateRange === "all" ? "total" : "this period"}`}
          icon={Clock}
          custom={2}
        />
        <StatCard
          title="Gross Earnings"
          value={`$${summary.grossUsd.toFixed(2)}`}
          sub="Before deductions"
          icon={DollarSign}
          accent="bg-amber-100"
          iconColor="text-amber-600"
          custom={3}
        />
        <StatCard
          title="Net (USD)"
          value={`$${summary.netUsd.toFixed(2)}`}
          sub="After deductions"
          icon={TrendingUp}
          accent="bg-emerald-100"
          iconColor="text-emerald-600"
          custom={4}
        />
        <StatCard
          title="Net (INR)"
          value={`₹${summary.netInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          sub={`@ ₹${currency?.usdToInr || 0}/$`}
          icon={Wallet}
          accent="bg-emerald-100"
          iconColor="text-emerald-600"
          custom={5}
        />
        <StatCard
          title="Deductions"
          value={`$${summary.deductions.toFixed(2)}`}
          sub="Fees & Taxes"
          icon={PieChartIcon}
          accent="bg-orange-100"
          iconColor="text-orange-600"
          custom={6}
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-7">

        {/* Activity trend */}
        <motion.div
          variants={fade} custom={7} initial="hidden" animate="show"
          className="lg:col-span-4 bg-card border border-border/60 rounded-2xl overflow-hidden"
        >
          <div className="px-6 pt-5 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>
                Activity Trend
              </p>
              <h3 className="text-sm font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                {rangeLabel}
              </h3>
            </div>
            {lineChartData.some(d => d.hours > 0) && (
              <div className="flex gap-5 text-xs" style={{ fontFamily: "'DM Mono', monospace" }}>
                {[
                  { label: "Min", val: chartStats.min },
                  { label: "Avg", val: chartStats.avg },
                  { label: "Max", val: chartStats.max },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="font-bold text-foreground">{s.val}h</p>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4">
            {lineChartData.some(d => d.hours > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={lineChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(38,92%,50%)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="hsl(38,92%,50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,92%)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    stroke="hsl(220,10%,60%)"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    stroke="hsl(220,10%,60%)"
                    tickFormatter={v => `${v}h`}
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v.toFixed(1)} hrs`, "Hours"]}
                    cursor={{ stroke: "hsl(38,92%,50%)", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="hsl(38,92%,50%)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(38,92%,50%)", strokeWidth: 2, stroke: "white" }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "white" }}
                    fill="url(#areaGrad)"
                    isAnimationActive
                    animationDuration={700}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <AnimatedEmptyState title="No activity yet" description="Log hours to see your trend" />
              </div>
            )}
          </div>
        </motion.div>

        {/* Project distribution */}
        <motion.div
          variants={fade} custom={8} initial="hidden" animate="show"
          className="lg:col-span-3 bg-card border border-border/60 rounded-2xl overflow-hidden"
        >
          <div className="px-6 pt-5 pb-4 border-b border-border/40 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>
                Projects
              </p>
              <h3 className="text-sm font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                Distribution
              </h3>
            </div>
            {projectPieData.length > 0 && (
              <span className="text-xs font-semibold tabular-nums" style={{ fontFamily: "'DM Mono', monospace", color: "hsl(38,92%,50%)" }}>
                {projectPieData.reduce((s, p) => s + p.value, 0).toFixed(1)}h total
              </span>
            )}
          </div>

          <div className="p-4">
            {projectPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={projectPieData}
                    cx="50%" cy="45%"
                    innerRadius={58} outerRadius={88}
                    paddingAngle={4}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={700}
                    animationEasing="ease-out"
                  >
                    {projectPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v.toFixed(2)} hrs`, "Time"]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontFamily: "'Manrope', sans-serif", fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <AnimatedEmptyState title="No projects tracked" description="Create a project and log hours" />
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Recent entries ──────────────────────────────────────── */}
      <motion.div
        variants={fade} custom={9} initial="hidden" animate="show"
        className="bg-card border border-border/60 rounded-2xl overflow-hidden"
      >
        <div className="px-6 pt-5 pb-4 border-b border-border/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>
            Recent Entries
          </p>
          <h3 className="text-sm font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
            {rangeLabel}
          </h3>
        </div>

        <div className="divide-y divide-border/40">
          {filteredEntries.length > 0 ? (
            filteredEntries.slice(0, 10).map((entry, i) => {
              const project = projects.find(p => p.id === entry.projectId);
              return (
                <motion.div
                  key={entry.id}
                  data-testid={`entry-${entry.id}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 * i }}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors duration-150 group"
                >
                  {/* Color dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-card"
                    style={{ background: project?.color || "#888", "--tw-ring-color": project?.color || "#888" } as React.CSSProperties}
                  />

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {project?.name || "Unknown Project"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {format(new Date(entry.date), "PPP")}
                      {entry.description ? ` · ${entry.description}` : ""}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums" style={{ fontFamily: "'DM Mono', monospace" }}>
                      {formatMinutesReadable(entry.minutes)}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums mt-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>
                      ${(entry.grossUsd || 0).toFixed(2)} · ₹{(entry.netInr || 0).toFixed(0)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                    <button
                      onClick={() => setEditingEntryId(entry.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      title="Edit entry"
                      aria-label="Edit entry"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingEntryId(entry.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete entry"
                      aria-label="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="py-12">
              <AnimatedEmptyState
                title="No time entries in this period"
                description="Start logging hours to track your productivity and earnings"
              />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
