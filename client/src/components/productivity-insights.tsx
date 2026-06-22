import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { TrendingUp, Zap, Target, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/lib/animations";
import { useTimeEntries, useProjects, useCurrencySettings } from "@/lib/hooks";
import { minutesToHoursDecimal } from "@shared/time";

const fade = (i = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07, ease: EASE_OUT_EXPO } },
});

interface InsightCardProps {
  icon: React.ReactNode;
  label: string;
  index: number;
  children: React.ReactNode;
  accent?: string;
}

function InsightCard({ icon, label, index, children, accent = "hsl(38,92%,50%)" }: InsightCardProps) {
  return (
    <motion.div
      {...fade(index)}
      className="bg-card border border-border/60 rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="h-0.5 w-full" style={{ background: accent }} />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${accent}18` }}>
            <span style={{ color: accent }}>{icon}</span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
            style={{ fontFamily: "'DM Mono', monospace" }}>
            {label}
          </p>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

export function ProductivityInsights() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const { data: currency } = useCurrencySettings();

  const insights = useMemo(() => {
    if (!entries.length) {
      return { topProject: null, topDay: null, averageDaily: 0, totalEarnings: 0 };
    }

    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const weeklyEntries = entries.filter(e => {
      if (!e.date) return false;
      const entryDate = typeof e.date === "string" ? parseISO(e.date) : e.date;
      return entryDate >= weekStart && entryDate <= weekEnd;
    });

    const projectEarnings: { [key: string]: number } = {};
    weeklyEntries.forEach(entry => {
      const project = projects.find(p => p.id === entry.projectId);
      if (project) {
        projectEarnings[entry.projectId] = (projectEarnings[entry.projectId] || 0) + (entry.netUsd || 0);
      }
    });

    const topProjectId = Object.keys(projectEarnings).reduce((a, b) =>
      projectEarnings[a] > projectEarnings[b] ? a : b, Object.keys(projectEarnings)[0]
    );
    const topProject = projects.find(p => p.id === topProjectId);

    const dayMinutes: { [key: string]: number } = {};
    weeklyEntries.forEach(entry => {
      const date = new Date(entry.date || "");
      const dayKey = format(date, "EEEE");
      dayMinutes[dayKey] = (dayMinutes[dayKey] || 0) + (entry.minutes || 0);
    });

    const topDayName = Object.keys(dayMinutes).reduce((a, b) =>
      dayMinutes[a] > dayMinutes[b] ? a : b, Object.keys(dayMinutes)[0]
    );
    const topDayHours = minutesToHoursDecimal(dayMinutes[topDayName] || 0);

    const totalWeeklyHours = minutesToHoursDecimal(weeklyEntries.reduce((sum, e) => sum + (e.minutes || 0), 0));
    const totalWeeklyEarnings = weeklyEntries.reduce((sum, e) => sum + (e.netUsd || 0), 0);
    const averageDailyHours = totalWeeklyHours / 7;
    const averageDailyEarnings = totalWeeklyEarnings / 7;

    return {
      topProject,
      topProjectEarnings: projectEarnings[topProjectId] || 0,
      topDayName,
      topDayHours,
      averageDailyHours,
      averageDailyEarnings,
      totalWeeklyEarnings,
      totalWeeklyHours,
    };
  }, [entries, projects]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Top Project */}
      <InsightCard
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        label="Top Earning Project"
        index={0}
        accent="hsl(38,92%,50%)"
      >
        {insights.topProject ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full ring-2 ring-offset-1 ring-offset-card"
                style={{ background: insights.topProject.color, "--tw-ring-color": insights.topProject.color } as React.CSSProperties} />
              <span className="font-bold text-sm truncate" style={{ fontFamily: "'Syne', sans-serif" }}>
                {insights.topProject.name}
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums"
                style={{ fontFamily: "'Syne', sans-serif", color: "hsl(155,60%,38%)" }}>
                ${insights.topProjectEarnings?.toFixed(2) || "0.00"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                @ ${insights.topProject.rate}/hr this week
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
            No data yet
          </p>
        )}
      </InsightCard>

      {/* Most Productive Day */}
      <InsightCard
        icon={<Zap className="w-3.5 h-3.5" />}
        label="Most Productive Day"
        index={1}
        accent="hsl(258,80%,65%)"
      >
        {insights.topDayName ? (
          <>
            <p className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              {insights.topDayName}
            </p>
            <div>
              <p className="text-lg font-semibold tabular-nums text-primary"
                style={{ fontFamily: "'DM Mono', monospace" }}>
                {insights.topDayHours.toFixed(1)}h
              </p>
              <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Hours logged on this day
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
            No data yet
          </p>
        )}
      </InsightCard>

      {/* Daily Average */}
      <InsightCard
        icon={<Clock className="w-3.5 h-3.5" />}
        label="Daily Average"
        index={2}
        accent="hsl(200,80%,55%)"
      >
        <div className="space-y-2.5">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Hours / Day
            </span>
            <span className="text-lg font-bold tabular-nums" style={{ fontFamily: "'Syne', sans-serif" }}>
              {(insights.averageDailyHours || 0).toFixed(1)}h
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-2 border-t border-border/40">
            <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Earnings / Day
            </span>
            <span className="text-lg font-bold tabular-nums"
              style={{ fontFamily: "'Syne', sans-serif", color: "hsl(155,60%,38%)" }}>
              ${(insights.averageDailyEarnings || 0).toFixed(2)}
            </span>
          </div>
        </div>
      </InsightCard>

      {/* This Week */}
      <InsightCard
        icon={<Target className="w-3.5 h-3.5" />}
        label="This Week"
        index={3}
        accent="hsl(155,60%,38%)"
      >
        <div className="space-y-2.5">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Total Hours
            </span>
            <span className="text-lg font-bold tabular-nums" style={{ fontFamily: "'Syne', sans-serif" }}>
              {(insights.totalWeeklyHours || 0).toFixed(1)}h
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-2 border-t border-border/40">
            <span className="text-xs font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Total Earnings
            </span>
            <span className="text-lg font-bold tabular-nums"
              style={{ fontFamily: "'Syne', sans-serif", color: "hsl(155,60%,38%)" }}>
              ${(insights.totalWeeklyEarnings || 0).toFixed(2)}
            </span>
          </div>
        </div>
      </InsightCard>
    </div>
  );
}
