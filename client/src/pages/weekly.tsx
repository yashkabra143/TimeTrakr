import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimeEntries, useProjects, useCurrencySettings } from "@/lib/hooks";

export default function Weekly() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const { data: currency } = useCurrencySettings();
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const nextWeek = () => setCurrentDate(d => addWeeks(d, 1));
  const prevWeek = () => setCurrentDate(d => subWeeks(d, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Helper to get data for a specific project on a specific day
  const getDayData = (projectId: string, date: Date) => {
    const dayEntries = entries.filter(e => 
      e.projectId === projectId && 
      isSameDay(new Date(e.date), date)
    );
    
    const hours = dayEntries.reduce((acc, e) => acc + (e.hours || 0), 0);
    const gross = dayEntries.reduce((acc, e) => acc + (e.grossUsd || 0), 0);
    const netUsd = dayEntries.reduce((acc, e) => acc + (e.netUsd || 0), 0);
    const netInr = dayEntries.reduce((acc, e) => acc + (e.netInr || 0), 0);

    return { hours, gross, netUsd, netInr };
  };

  // Calculate weekly totals per project
  const getProjectWeeklyTotal = (projectId: string) => {
    const weeklyEntries = entries.filter(e => 
      e.projectId === projectId && 
      new Date(e.date) >= weekStart && 
      new Date(e.date) <= weekEnd
    );

    return {
      hours: weeklyEntries.reduce((acc, e) => acc + (e.hours || 0), 0),
      gross: weeklyEntries.reduce((acc, e) => acc + (e.grossUsd || 0), 0),
      netUsd: weeklyEntries.reduce((acc, e) => acc + (e.netUsd || 0), 0),
      netInr: weeklyEntries.reduce((acc, e) => acc + (e.netInr || 0), 0),
    };
  };

  return (
    <div className="space-y-6 md:space-y-8 px-4 md:px-0">
      <div className="flex flex-col gap-4 md:gap-0 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-heading">Weekly Tracking</h1>
          <p className="text-sm md:text-base text-muted-foreground">Detailed breakdown of your week.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-card p-2 rounded-lg border shadow-sm">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={prevWeek} data-testid="button-prev-week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-2 sm:px-4 font-medium text-center text-sm md:text-base flex items-center justify-center gap-2 whitespace-nowrap min-w-fit md:min-w-[200px]">
            <CalendarIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="hidden sm:inline">{format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}</span>
            <span className="sm:hidden">{format(weekStart, "MMM d")} - {format(weekEnd, "d")}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={nextWeek} data-testid="button-next-week">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="hidden sm:block w-px h-6 bg-border mx-1" />
          <Button variant="ghost" size="sm" className="h-10" onClick={goToToday} data-testid="button-today">
            Today
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {projects.map(project => {
          const totals = getProjectWeeklyTotal(project.id);
          
          return (
            <Card key={project.id} className="border-none shadow-md overflow-hidden flex flex-col hover:shadow-lg transition-shadow duration-200" data-testid={`project-card-${project.id}`}>
              <div className="h-2 w-full" style={{ backgroundColor: project.color }} />
              <CardHeader className="pb-2 p-4 md:p-6">
                <CardTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-base md:text-lg">
                  <span>{project.name}</span>
                  <span className="text-xs md:text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full w-fit">
                    ${project.rate}/hr
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4 p-4 md:p-6">
                {/* Weekly Summary Card */}
                <div className="bg-muted/30 rounded-lg p-4 space-y-2 border border-border/50">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-muted-foreground">Total Hours</span>
                    <span className="text-xl font-bold">{totals.hours.toFixed(2)}h</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-muted-foreground">Gross USD</span>
                    <span className="font-medium">${totals.gross.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-muted-foreground">Net USD</span>
                    <span className="font-medium text-primary">${totals.netUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-border/50">
                    <span className="text-sm font-medium">Net INR</span>
                    <span className="font-bold text-green-600">₹{totals.netInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>

                {/* Daily Breakdown List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Daily Breakdown</h4>
                  {days.map(day => {
                    const data = getDayData(project.id, day);
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <div 
                        key={day.toISOString()} 
                        className={cn(
                          "flex items-center justify-between p-2 rounded text-sm",
                          data.hours > 0 ? "bg-primary/5" : "text-muted-foreground",
                          isToday && "ring-1 ring-primary ring-inset"
                        )}
                      >
                        <span className={cn("w-8 font-medium", isToday && "text-primary")}>{format(day, "EEE")}</span>
                        <span className="flex-1 text-center text-xs text-muted-foreground">
                          {data.hours > 0 ? `$${data.gross.toFixed(0)}` : '-'}
                        </span>
                        <span className={cn("font-medium", data.hours > 0 ? "text-foreground" : "text-muted-foreground/50")}>
                          {data.hours > 0 ? `${data.hours}h` : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
