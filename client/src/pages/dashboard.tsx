import * as React from "react";
import { StatsCard } from "@/components/ui/stats-card";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import {
  Clock,
  DollarSign,
  Wallet,
  PieChart as PieChartIcon,
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
  Legend
} from "recharts";
import { format, startOfWeek, endOfWeek, startOfMonth, isWithinInterval, parseISO, subDays, subWeeks } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntryForm } from "@/components/entry-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTimeEntries, useProjects, useCurrencySettings } from "@/lib/hooks";

export default function Dashboard() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const { data: currency } = useCurrencySettings();
  const [dateRange, setDateRange] = React.useState("week");

  // Helper to filter entries
  const getEntriesInDateRange = (startDate: Date, endDate: Date) => {
    return entries.filter(e => {
      if (!e.date) return false;
      const entryDate = new Date(e.date);
      return isWithinInterval(entryDate, { start: startDate, end: endDate });
    });
  };

  // Date Ranges
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });

  const monthStart = startOfMonth(today);

  // Determine current range interval
  const currentInterval = React.useMemo(() => {
    switch (dateRange) {
      case "week": return { start: weekStart, end: weekEnd };
      case "last_week": return { start: lastWeekStart, end: lastWeekEnd };
      case "month": return { start: monthStart, end: today };
      case "all": return { start: new Date(0), end: today }; // All time
      default: return { start: weekStart, end: weekEnd };
    }
  }, [dateRange, today]);

  // Filter entries based on selected range
  const filteredEntries = React.useMemo(() => {
    return getEntriesInDateRange(currentInterval.start, currentInterval.end);
  }, [entries, currentInterval]);

  // Calculate Summaries
  const calculateSummary = (data: typeof entries) => {
    return data.reduce((acc, curr) => ({
      hours: acc.hours + (curr.hours || 0),
      grossUsd: acc.grossUsd + (curr.grossUsd || 0),
      netUsd: acc.netUsd + (curr.netUsd || 0),
      netInr: acc.netInr + (curr.netInr || 0),
      deductions: acc.deductions + (curr.deductionTotal || 0)
    }), { hours: 0, grossUsd: 0, netUsd: 0, netInr: 0, deductions: 0 });
  };

  const summary = calculateSummary(filteredEntries);

  // Chart Data Preparation
  const lineChartData = React.useMemo(() => {
    // For "All Time", show last 30 days to avoid overcrowding
    // For others, show the specific range
    let start = currentInterval.start;
    let end = currentInterval.end;

    // If "All Time" or range > 30 days, limit to last 30 days for the chart
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    if (daysDiff > 31) {
      start = subDays(end, 30);
    }

    const days = [];
    let curr = start;
    while (curr <= end) {
      days.push(curr);
      curr = new Date(curr.getTime() + 24 * 60 * 60 * 1000);
      // Safety break
      if (days.length > 365) break;
    }

    return days.map(date => {
      const dateStr = format(date, 'MMM dd');
      const dayEntries = filteredEntries.filter(e => e.date && format(new Date(e.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
      const hours = dayEntries.reduce((acc, e) => acc + (e.hours || 0), 0);
      return { name: dateStr, hours };
    });
  }, [filteredEntries, currentInterval]);

  // Project Distribution
  const projectPieData = React.useMemo(() => {
    return projects.map(p => ({
      name: p.name,
      value: filteredEntries.filter(e => e.projectId === p.id).reduce((acc, e) => acc + (e.hours || 0), 0),
      color: p.color
    })).filter(d => d.value > 0);
  }, [filteredEntries, projects]);

  const rangeLabel = {
    week: "This Week",
    last_week: "Last Week",
    month: "This Month",
    all: "All Time"
  }[dateRange];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-heading">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back. Here's your productivity overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <ChangePasswordDialog />
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg shadow-primary/20" data-testid="button-log-hours">
                <Clock className="mr-2 h-4 w-4" />
                Log Hours
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Quick Log</DialogTitle>
                <DialogDescription>
                  Add a new time entry. It will be added to your weekly summary.
                </DialogDescription>
              </DialogHeader>
              <EntryForm onSuccess={() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { 'key': 'Escape' }));
              }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={dateRange} onValueChange={setDateRange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="last_week">Last Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatsCard
            title="Total Hours"
            value={(summary.hours || 0).toFixed(2)}
            subValue={`Hours logged ${dateRange === 'all' ? 'total' : 'this period'}`}
            icon={Clock}
          />
          <StatsCard
            title="Gross Earnings"
            value={`$${(summary.grossUsd || 0).toFixed(2)}`}
            subValue="Before deductions"
            icon={DollarSign}
            className="value-accent"
          />
          <StatsCard
            title="Net Income (USD)"
            value={`$${(summary.netUsd || 0).toFixed(2)}`}
            subValue="After deductions"
            icon={DollarSign}
            className="value-success"
          />
          <StatsCard
            title="Net Income (INR)"
            value={`₹${(summary.netInr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            subValue={`@ ₹${currency?.usdToInr || 0}/$`}
            icon={Wallet}
            className="value-success"
          />
          <StatsCard
            title="Total Deductions"
            value={`$${(summary.deductions || 0).toFixed(2)}`}
            subValue="Fees & Taxes"
            icon={PieChartIcon}
            className="value-warning"
          />
        </div>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle>Activity Trend ({rangeLabel})</CardTitle>
            <CardDescription>
              Hours logged over the selected period.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {lineChartData.some(d => d.hours > 0) ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={lineChartData}>
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}h`}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="text-sm">No activity in this period</p>
                  <p className="text-xs mt-1">Log hours to see your activity here</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle>Project Distribution ({rangeLabel})</CardTitle>
            <CardDescription>
              Time spent across projects.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projectPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={projectPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {projectPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toFixed(2)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="text-sm">No projects tracked</p>
                  <p className="text-xs mt-1">Create a project and log hours to get started</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader>
          <CardTitle>Recent Entries ({rangeLabel})</CardTitle>
          <CardDescription>
            Logged sessions in this period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredEntries.length > 0 ? (
              filteredEntries.slice(0, 10).map((entry) => {
                const project = projects.find(p => p.id === entry.projectId);
                return (
                  <div key={entry.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors duration-150" data-testid={`entry-${entry.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-12 rounded-full" style={{ backgroundColor: project?.color || 'gray' }} />
                      <div>
                        <p className="font-medium">{project?.name || 'Unknown Project'}</p>
                        <p className="text-sm text-muted-foreground">{format(new Date(entry.date), "PPP")} • {entry.description || 'No description'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{entry.hours} hrs</p>
                      <p className="text-sm text-muted-foreground">${(entry.grossUsd || 0).toFixed(2)} / ₹{(entry.netInr || 0).toFixed(0)}</p>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="space-y-2">
                  <p className="text-sm font-medium">No time entries in this period</p>
                  <p className="text-xs">Start logging hours to track your productivity and earnings</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
