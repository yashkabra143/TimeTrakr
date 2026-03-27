import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from "date-fns";
import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimeEntries, useProjects, useCurrencySettings } from "@/lib/hooks";
import { formatMinutesReadable, minutesToHoursDecimal } from "@shared/time";

const fade = (i = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] } },
});

export default function Weekly() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const { data: currency } = useCurrencySettings();
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const nextWeek = () => setCurrentDate(d => addWeeks(d, 1));
  const prevWeek = () => setCurrentDate(d => subWeeks(d, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getDayData = (projectId: string, date: Date) => {
    const dayEntries = entries.filter(e =>
      e.projectId === projectId && isSameDay(new Date(e.date), date)
    );
    return {
      minutes: dayEntries.reduce((a, e) => a + (e.minutes || 0), 0),
      gross:   dayEntries.reduce((a, e) => a + (e.grossUsd || 0), 0),
      netUsd:  dayEntries.reduce((a, e) => a + (e.netUsd || 0), 0),
      netInr:  dayEntries.reduce((a, e) => a + (e.netInr || 0), 0),
    };
  };

  const getWeeklyTotal = (projectId: string) => {
    const we = entries.filter(e =>
      e.projectId === projectId &&
      new Date(e.date) >= weekStart &&
      new Date(e.date) <= weekEnd
    );
    return {
      minutes: we.reduce((a, e) => a + (e.minutes || 0), 0),
      gross:   we.reduce((a, e) => a + (e.grossUsd || 0), 0),
      netUsd:  we.reduce((a, e) => a + (e.netUsd || 0), 0),
      netInr:  we.reduce((a, e) => a + (e.netInr || 0), 0),
    };
  };

  const isCurrentWeek = isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="space-y-7 pb-8">

      {/* Header */}
      <motion.div {...fade(0)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-1"
            style={{ fontFamily: "'DM Mono', monospace" }}>
            Weekly View
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            Weekly Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Detailed breakdown of your week.
          </p>
        </div>

        {/* Week navigator */}
        <motion.div
          {...fade(0)}
          className="flex items-center gap-1 p-1 rounded-xl border border-border/60 bg-card shadow-sm"
        >
          <button
            onClick={prevWeek}
            data-testid="button-prev-week"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-3 text-sm font-semibold whitespace-nowrap"
            style={{ fontFamily: "'DM Mono', monospace" }}>
            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}</span>
          </div>

          <button
            onClick={nextWeek}
            data-testid="button-next-week"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-border mx-0.5" />

          <button
            onClick={goToToday}
            data-testid="button-today"
            className={cn(
              "px-3 h-8 rounded-lg text-xs font-semibold transition-colors",
              isCurrentWeek
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            style={{
              fontFamily: "'Manrope', sans-serif",
              background: isCurrentWeek ? "hsl(38,92%,50%)" : "transparent",
              color: isCurrentWeek ? "hsl(228,25%,9%)" : undefined,
            }}
          >
            Today
          </button>
        </motion.div>
      </motion.div>

      {/* Project cards */}
      {projects.length === 0 ? (
        <motion.div {...fade(1)}
          className="bg-card border border-border/60 rounded-2xl p-12 text-center">
          <p className="text-sm font-semibold text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
            No projects yet. Add a project in Settings to get started.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project, i) => {
            const totals = getWeeklyTotal(project.id);
            const milestoneCount = entries.filter(e =>
              e.projectId === project.id &&
              new Date(e.date) >= weekStart &&
              new Date(e.date) <= weekEnd
            ).length;

            return (
              <motion.div
                key={project.id}
                {...fade(i + 1)}
                data-testid={`project-card-${project.id}`}
                className="bg-card border border-border/60 rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* Color bar */}
                <div className="h-1 w-full" style={{ background: project.color }} />

                <div className="p-5 space-y-4">
                  {/* Project name + rate badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-card"
                        style={{ background: project.color }} />
                      <h3 className="font-bold text-sm truncate" style={{ fontFamily: "'Syne', sans-serif" }}>
                        {project.name}
                      </h3>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        background: "hsl(220,15%,94%)",
                        color: "hsl(220,10%,45%)",
                      }}
                    >
                      {project.type === "fixed" ? "Fixed" : `$${project.rate}/hr`}
                    </span>
                  </div>

                  {/* Weekly summary */}
                  <div
                    className="rounded-xl p-4 space-y-2.5"
                    style={{ background: "hsl(220,15%,97%)", border: "1px solid hsl(220,15%,90%)" }}
                  >
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        {project.type === "fixed" ? "Milestones" : "Total Hours"}
                      </span>
                      <span className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                        {project.type === "fixed"
                          ? `${milestoneCount} Submitted`
                          : formatMinutesReadable(totals.minutes)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>Gross USD</span>
                      <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: "'DM Mono', monospace" }}>
                        ${totals.gross.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>Net USD</span>
                      <span className="text-sm font-semibold tabular-nums text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>
                        ${totals.netUsd.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 border-t border-border/40">
                      <span className="text-xs font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>Net INR</span>
                      <span className="text-sm font-bold tabular-nums" style={{ fontFamily: "'DM Mono', monospace", color: "hsl(155,60%,38%)" }}>
                        ₹{totals.netInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  {/* Daily breakdown */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2"
                      style={{ fontFamily: "'DM Mono', monospace" }}>
                      Daily Breakdown
                    </p>
                    {days.map(day => {
                      const data = getDayData(project.id, day);
                      const isToday = isSameDay(day, new Date());
                      const hasData = data.minutes > 0;

                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors",
                            hasData ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/40 text-muted-foreground",
                            isToday && "ring-1 ring-primary/40"
                          )}
                        >
                          <span
                            className={cn("w-8 font-semibold", isToday && "text-primary")}
                            style={{ fontFamily: "'DM Mono', monospace" }}
                          >
                            {format(day, "EEE")}
                          </span>
                          <span className="flex-1 text-center text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                            {hasData ? `$${data.gross.toFixed(0)}` : "—"}
                          </span>
                          <span
                            className={cn("text-right font-semibold", hasData ? "text-foreground" : "text-muted-foreground/40")}
                            style={{ fontFamily: "'DM Mono', monospace" }}
                          >
                            {hasData
                              ? (project.type === "fixed" ? `$${data.gross.toFixed(0)}` : formatMinutesReadable(data.minutes))
                              : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
