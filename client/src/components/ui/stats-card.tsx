import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
}

export function StatsCard({ title, value, subValue, icon: Icon, trend, trendValue, className }: StatsCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden bg-card border border-border/60 rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          style={{ fontFamily: "'DM Mono', monospace" }}>
          {title}
        </p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "hsl(38,92%,50%,0.12)" }}>
          <Icon className="h-4 w-4" style={{ color: "hsl(38,92%,45%)" }} />
        </div>
      </div>

      <p className="text-2xl font-bold tabular-nums leading-none"
        style={{ fontFamily: "'Syne', sans-serif" }}>
        {value}
      </p>

      {subValue && (
        <p className="text-xs text-muted-foreground mt-1.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
          {subValue}
        </p>
      )}

      {trend && trendValue && (
        <div className={cn(
          "flex items-center mt-2 text-xs font-semibold",
          trend === "up" ? "text-emerald-600" : trend === "down" ? "text-destructive" : "text-muted-foreground"
        )} style={{ fontFamily: "'Manrope', sans-serif" }}>
          {trend === "up"
            ? <ArrowUpRight className="mr-1 h-3 w-3" />
            : <ArrowDownRight className="mr-1 h-3 w-3" />}
          {trendValue}
        </div>
      )}

      {/* Ambient glow */}
      <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(38,92%,50%,0.06) 0%, transparent 70%)" }} />
    </div>
  );
}
