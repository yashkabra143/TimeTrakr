import { StatsCard } from "@/components/ui/stats-card";
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

  // Calculate Summaries with NaN protection
  const calculateSummary = (filteredEntries: typeof entries) => {
    return filteredEntries.reduce((acc, curr) => ({
      hours: acc.hours + (curr.hours || 0),
      grossUsd: acc.grossUsd + (curr.grossUsd || 0),
      netUsd: acc.netUsd + (curr.netUsd || 0),
      netInr: acc.netInr + (curr.netInr || 0),
      deductions: acc.deductions + (curr.deductionTotal || 0)
    }), { hours: 0, grossUsd: 0, netUsd: 0, netInr: 0, deductions: 0 });
  };

  const weekSummary = calculateSummary(getEntriesInDateRange(weekStart, weekEnd));
  const lastWeekSummary = calculateSummary(getEntriesInDateRange(lastWeekStart, lastWeekEnd));
  const monthSummary = calculateSummary(getEntriesInDateRange(monthStart, today));
  const allTimeSummary = calculateSummary(entries);

  // Chart Data Preparation
  const lineChartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(today, 6 - i);
    const dateStr = format(date, 'EEE');
    const dayEntries = entries.filter(e => e.date && format(new Date(e.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
    const hours = dayEntries.reduce((acc, e) => acc + (e.hours || 0), 0);
    return { name: dateStr, hours };
  });

  // Project Distribution
  const projectPieData = projects.map(p => ({
    name: p.name,
    value: entries.filter(e => e.projectId === p.id).reduce((acc, e) => acc + (e.hours || 0), 0),
    color: p.color
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-heading">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back. Here's your productivity overview.</p>
        </div>
        <div className="flex items-center gap-2">
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

      <Tabs defaultValue="week" className="space-y-4">
        <TabsList>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="last_week">Last Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Hours"
              value={(weekSummary.hours || 0).toFixed(2)}
              subValue="Hours logged this week"
              icon={Clock}
              className="bg-white dark:bg-card"
            />
            <StatsCard
              title="Gross Earnings"
              value={`$${(weekSummary.grossUsd || 0).toFixed(2)}`}
              subValue="Before deductions"
              icon={DollarSign}
            />
            <StatsCard
              title="Net Income (USD)"
              value={`$${(weekSummary.netUsd || 0).toFixed(2)}`}
              subValue="After deductions"
              icon={DollarSign}
              className="text-primary"
            />
            <StatsCard
              title="Net Income (INR)"
              value={`₹${(weekSummary.netInr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              subValue={`@ ₹${currency?.usdToInr || 0}/$`}
              icon={Wallet}
            />
            <StatsCard
              title="Total Deductions"
              value={`$${(weekSummary.deductions || 0).toFixed(2)}`}
              subValue="Fees & Taxes"
              icon={PieChartIcon}
            />
          </div>
        </TabsContent>

        <TabsContent value="last_week" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Hours"
              value={(lastWeekSummary.hours || 0).toFixed(2)}
              subValue="Hours logged last week"
              icon={Clock}
              className="bg-white dark:bg-card"
            />
            <StatsCard
              title="Gross Earnings"
              value={`$${(lastWeekSummary.grossUsd || 0).toFixed(2)}`}
              subValue="Before deductions"
              icon={DollarSign}
            />
            <StatsCard
              title="Net Income (USD)"
              value={`$${(lastWeekSummary.netUsd || 0).toFixed(2)}`}
              subValue="After deductions"
              icon={DollarSign}
              className="text-primary"
            />
            <StatsCard
              title="Net Income (INR)"
              value={`₹${(lastWeekSummary.netInr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              subValue={`@ ₹${currency?.usdToInr || 0}/$`}
              icon={Wallet}
            />
            <StatsCard
              title="Total Deductions"
              value={`$${(lastWeekSummary.deductions || 0).toFixed(2)}`}
              subValue="Fees & Taxes"
              icon={PieChartIcon}
            />
          </div>
        </TabsContent>

        <TabsContent value="month" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Total Hours" value={(monthSummary.hours || 0).toFixed(2)} icon={Clock} />
            <StatsCard title="Gross Earnings" value={`$${(monthSummary.grossUsd || 0).toFixed(2)}`} icon={DollarSign} />
            <StatsCard title="Net Income (USD)" value={`$${(monthSummary.netUsd || 0).toFixed(2)}`} icon={DollarSign} className="text-primary" />
            <StatsCard title="Net Income (INR)" value={`₹${(monthSummary.netInr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={Wallet} />
            <StatsCard title="Total Deductions" value={`$${(monthSummary.deductions || 0).toFixed(2)}`} icon={PieChartIcon} />
          </div>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Total Hours" value={(allTimeSummary.hours || 0).toFixed(2)} icon={Clock} />
            <StatsCard title="Gross Earnings" value={`$${(allTimeSummary.grossUsd || 0).toFixed(2)}`} icon={DollarSign} />
            <StatsCard title="Net Income (USD)" value={`$${(allTimeSummary.netUsd || 0).toFixed(2)}`} icon={DollarSign} className="text-primary" />
            <StatsCard title="Net Income (INR)" value={`₹${(allTimeSummary.netInr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={Wallet} />
            <StatsCard title="Total Deductions" value={`$${(allTimeSummary.deductions || 0).toFixed(2)}`} icon={PieChartIcon} />
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
            <CardDescription>
              Hours logged over the last 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
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
          </CardContent>
        </Card>

        <Card className="col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Project Distribution</CardTitle>
            <CardDescription>
              Time spent across projects (All Time).
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Recent Entries</CardTitle>
          <CardDescription>
            Your last 10 logged sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {entries.slice(0, 10).map((entry) => {
              const project = projects.find(p => p.id === entry.projectId);
              return (
                <div key={entry.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors" data-testid={`entry-${entry.id}`}>
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
            })}
            {entries.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No entries found. Start tracking time!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
