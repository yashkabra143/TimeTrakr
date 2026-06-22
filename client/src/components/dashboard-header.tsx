import { format } from "date-fns";
import { Clock, TrendingUp, DollarSign, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/lib/animations";
import { useTimeEntries, useProjects, useCurrencySettings } from "@/lib/hooks";
import { minutesToHoursDecimal } from "@shared/time";
import { AnimatedCounter } from "@/components/animated-counter";

const fade = (i = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.08, ease: EASE_OUT_EXPO } },
});

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  index: number;
  valueColor?: string;
}

function StatTile({ label, value, sub, icon, iconBg, iconColor, index, valueColor }: StatTileProps) {
  return (
    <motion.div
      {...fade(index)}
      className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          style={{ fontFamily: "'DM Mono', monospace" }}>
          {label}
        </p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: iconBg }}>
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums leading-none"
          style={{ fontFamily: "'Syne', sans-serif", color: valueColor }}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
          {sub}
        </p>
      </div>
    </motion.div>
  );
}

export function DashboardHeader() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const { data: currency } = useCurrencySettings();

  const today = new Date();
  const todayEntries = entries.filter(e => {
    if (!e.date) return false;
    const entryDate = new Date(e.date);
    return entryDate.toDateString() === today.toDateString();
  });

  const todayStats = todayEntries.reduce((acc, entry) => {
    const project = projects.find(p => p.id === entry.projectId);
    if (project) {
      const hoursDecimal = minutesToHoursDecimal(entry.minutes || 0);
      const gross = hoursDecimal * project.rate;
      return {
        minutes: acc.minutes + (entry.minutes || 0),
        gross: acc.gross + gross,
        net: acc.net + (entry.netUsd || 0),
      };
    }
    return acc;
  }, { minutes: 0, gross: 0, net: 0 });

  const totalHours = minutesToHoursDecimal(todayStats.minutes || 0);
  const avgHourlyRate = totalHours > 0 ? (todayStats.gross / totalHours).toFixed(2) : 0;
  const netInr = todayStats.net * (currency?.usdToInr || 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <motion.div {...fade(0)} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-1"
            style={{ fontFamily: "'DM Mono', monospace" }}>
            Overview
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {greeting}. Here's your overview for {format(today, "EEEE, MMMM d")}
          </p>
        </div>
      </motion.div>

      {/* Today's stat tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          index={1}
          label="Today's Hours"
          value={
            <AnimatedCounter
              value={totalHours}
              duration={1.5}
              format={(v) => `${v.toFixed(1)}h`}
            />
          }
          sub={`${todayEntries.length} ${todayEntries.length === 1 ? "entry" : "entries"} today`}
          icon={<Clock className="w-4 h-4" />}
          iconBg="hsl(38,92%,50%,0.12)"
          iconColor="hsl(38,92%,45%)"
        />

        <StatTile
          index={2}
          label="Gross Earnings"
          value={
            <AnimatedCounter
              value={todayStats.gross}
              duration={1.5}
              format={(v) => `$${v.toFixed(2)}`}
            />
          }
          sub={`@ $${avgHourlyRate}/hr avg rate`}
          icon={<TrendingUp className="w-4 h-4" />}
          iconBg="hsl(38,92%,50%,0.12)"
          iconColor="hsl(38,92%,45%)"
          valueColor="hsl(38,92%,42%)"
        />

        <StatTile
          index={3}
          label="Net Earnings (USD)"
          value={
            <AnimatedCounter
              value={todayStats.net}
              duration={1.5}
              format={(v) => `$${v.toFixed(2)}`}
            />
          }
          sub="After all deductions"
          icon={<DollarSign className="w-4 h-4" />}
          iconBg="hsl(155,60%,38%,0.1)"
          iconColor="hsl(155,60%,38%)"
          valueColor="hsl(155,60%,38%)"
        />

        <StatTile
          index={4}
          label="Net Earnings (INR)"
          value={
            <AnimatedCounter
              value={netInr}
              duration={1.5}
              format={(v) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            />
          }
          sub={`@ ₹${currency?.usdToInr || 0}/$ exchange rate`}
          icon={<Zap className="w-4 h-4" />}
          iconBg="hsl(155,60%,38%,0.1)"
          iconColor="hsl(155,60%,38%)"
          valueColor="hsl(155,60%,38%)"
        />
      </div>
    </div>
  );
}
