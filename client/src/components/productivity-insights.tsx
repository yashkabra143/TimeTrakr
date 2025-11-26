import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, parseISO, isSameDay } from "date-fns";
import { TrendingUp, Zap, Target, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTimeEntries, useProjects, useCurrencySettings } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function ProductivityInsights() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const { data: currency } = useCurrencySettings();

  const insights = useMemo(() => {
    if (!entries.length) {
      return { topProject: null, topDay: null, averageDaily: 0, totalEarnings: 0 };
    }

    // Get week range
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    // Weekly entries
    const weeklyEntries = entries.filter(e => {
      if (!e.date) return false;
      const entryDate = parseISO(e.date);
      return entryDate >= weekStart && entryDate <= weekEnd;
    });

    // Find top project by earnings
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

    // Find most productive day
    const dayHours: { [key: string]: number } = {};
    weeklyEntries.forEach(entry => {
      const date = new Date(entry.date || "");
      const dayKey = format(date, "EEEE");
      dayHours[dayKey] = (dayHours[dayKey] || 0) + (entry.hours || 0);
    });

    const topDayName = Object.keys(dayHours).reduce((a, b) =>
      dayHours[a] > dayHours[b] ? a : b, Object.keys(dayHours)[0]
    );
    const topDayHours = dayHours[topDayName] || 0;

    // Calculate averages
    const totalWeeklyHours = weeklyEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
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
      {/* Top Project Card */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-warning" />
            Top Earning Project
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.topProject ? (
            <>
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: insights.topProject.color }}
                />
                <span className="font-semibold">{insights.topProject.name}</span>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-success">
                  ${insights.topProjectEarnings?.toFixed(2) || "0.00"}
                </p>
                <p className="text-sm text-muted-foreground">
                  @ ${insights.topProject.rate}/hr this week
                </p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Most Productive Day Card */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Most Productive Day
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.topDayName ? (
            <>
              <p className="text-2xl font-bold">{insights.topDayName}</p>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-primary">
                  {insights.topDayHours.toFixed(1)}h
                </p>
                <p className="text-sm text-muted-foreground">
                  Hours logged on this day
                </p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Weekly Average Card */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            Daily Average
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Hours/Day</span>
              <span className="text-lg font-bold">{insights.averageDailyHours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Earnings/Day</span>
              <span className="text-lg font-bold text-success">
                ${insights.averageDailyEarnings.toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Total Card */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-warning" />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Hours</span>
              <span className="text-lg font-bold">{insights.totalWeeklyHours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Earnings</span>
              <span className="text-lg font-bold text-success">
                ${insights.totalWeeklyEarnings.toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
