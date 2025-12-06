import { format } from "date-fns";
import { Clock, TrendingUp, DollarSign, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTimeEntries, useProjects, useCurrencySettings } from "@/lib/hooks";
import { minutesToHoursDecimal } from "@shared/time";
import { cardVariants } from "@/lib/animations";
import { AnimatedCounter } from "@/components/animated-counter";

export function DashboardHeader() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const { data: currency } = useCurrencySettings();

  // Get today's entries
  const today = new Date();
  const todayEntries = entries.filter(e => {
    if (!e.date) return false;
    const entryDate = new Date(e.date);
    return entryDate.toDateString() === today.toDateString();
  });

  // Calculate today's stats
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

  // Calculate averages
  const totalHours = minutesToHoursDecimal(todayStats.minutes || 0);
  const avgHourlyRate = totalHours > 0 ? (todayStats.gross / totalHours).toFixed(2) : 0;
  const netInr = todayStats.net * (currency?.usdToInr || 0);

  // Get time greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            {greeting}. Here's your productivity overview for {format(today, "EEEE, MMMM d")}
          </p>
        </div>
      </div>

      {/* Today's Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hours Card */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <Card className="card-elevated group hover:bg-card/80 transition-all">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Today's Hours
                  </p>
                  <p className="text-2xl md:text-3xl font-bold font-heading">
                    <AnimatedCounter
                      value={totalHours}
                      duration={1.5}
                      format={(v) => `${v.toFixed(1)}h`}
                    />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {todayEntries.length} {todayEntries.length === 1 ? "entry" : "entries"}
                  </p>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Clock className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Gross Earnings Card */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          <Card className="card-elevated group hover:bg-card/80 transition-all">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Gross Earnings
                  </p>
                  <p className="text-2xl md:text-3xl font-bold font-heading text-warning">
                    <AnimatedCounter
                      value={todayStats.gross}
                      duration={1.5}
                      format={(v) => `$${v.toFixed(2)}`}
                    />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @ ${avgHourlyRate}/hr
                  </p>
                </div>
                <div className="p-2 bg-warning/10 rounded-lg group-hover:bg-warning/20 transition-colors">
                  <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Net Earnings Card */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={2}
        >
          <Card className="card-elevated group hover:bg-card/80 transition-all">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Net Earnings (USD)
                  </p>
                  <p className="text-2xl md:text-3xl font-bold font-heading text-success">
                    <AnimatedCounter
                      value={todayStats.net}
                      duration={1.5}
                      format={(v) => `$${v.toFixed(2)}`}
                    />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    After deductions
                  </p>
                </div>
                <div className="p-2 bg-success/10 rounded-lg group-hover:bg-success/20 transition-colors">
                  <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Net Earnings INR Card */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <Card className="card-elevated group hover:bg-card/80 transition-all">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Net Earnings (INR)
                  </p>
                  <p className="text-2xl md:text-3xl font-bold font-heading text-success">
                    <AnimatedCounter
                      value={netInr}
                      duration={1.5}
                      format={(v) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                    />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @ ₹{currency?.usdToInr || 0}/$
                  </p>
                </div>
                <div className="p-2 bg-success/10 rounded-lg group-hover:bg-success/20 transition-colors">
                  <Zap className="w-5 h-5 md:w-6 md:h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
