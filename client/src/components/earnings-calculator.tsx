import { useState } from "react";
import { Calculator, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { useProjects, useDeductions, useCurrencySettings } from "@/lib/hooks";
import { formatMinutesReadable } from "@shared/time";

export function EarningsCalculator() {
  const [open, setOpen] = useState(false);
  const [timeInput, setTimeInput] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const { data: projects = [] } = useProjects();
  const { data: deductions } = useDeductions();
  const { data: currency } = useCurrencySettings();

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const calculateEarnings = () => {
    if (!timeInput || !selectedProject || !deductions || !currency) return null;

    const hoursDecimal = parseFloat(String(timeInput)) || 0;
    if (hoursDecimal <= 0) return null;

    const rate = selectedProject.rate;
    const grossUsd = hoursDecimal * rate;

    const serviceFeePercent = deductions.serviceFee || 0;
    const tdsPercent = deductions.tds || 0;
    const gstPercent = deductions.gst || 0;

    const serviceAmt = grossUsd * (serviceFeePercent / 100);
    const tdsAmt = grossUsd * (tdsPercent / 100);
    const gstAmt = serviceAmt * (gstPercent / 100);

    const totalDeductions = serviceAmt + tdsAmt + gstAmt;
    const netUsd = Math.max(0, grossUsd - totalDeductions);

    const exchangeRate = currency.usdToInr || 0;
    const grossInr = grossUsd * exchangeRate;
    const netInr = netUsd * exchangeRate;

    const [hPart, mPart = "0"] = String(timeInput).split(".");
    const hInt = parseInt(hPart) || 0;
    const mInt = parseInt(mPart.padEnd(2, "0").slice(0, 2)) || 0;
    const displayMinutes = hInt * 60 + Math.min(mInt, 59);

    return {
      displayMinutes,
      hoursDecimal,
      timeDisplay: formatMinutesReadable(displayMinutes),
      rate,
      grossUsd,
      grossInr,
      netUsd,
      netInr,
      deductions: {
        serviceFee: serviceAmt,
        tds: tdsAmt,
        gst: gstAmt,
        total: totalDeductions,
      },
      exchangeRate,
    };
  };

  const result = calculateEarnings();

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <motion.button
          onClick={() => setOpen(true)}
          title="Open earnings calculator"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold border border-border/60 bg-card hover:bg-muted/50 transition-colors"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          <Calculator className="w-4 h-4" />
          <span className="hidden sm:inline">Calculator</span>
        </motion.button>

        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-0 gap-0">
          {/* Dialog header */}
          <div className="px-6 pt-6 pb-5 border-b border-border/60">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "hsl(38,92%,50%)" }}>
                  <Calculator className="w-4 h-4" style={{ color: "hsl(228,25%,9%)" }} />
                </div>
                <DialogTitle className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                  Earnings Calculator
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Calculate your earnings with deductions breakdown
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Inputs */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  style={{ fontFamily: "'DM Mono', monospace" }}>Hours Worked</p>
                <Input
                  type="number"
                  placeholder="1.30"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className="h-10 rounded-xl text-base"
                />
                <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  1.30 = 1 hr 30 min · 2.45 = 2 hr 45 min · 0.30 = 30 min
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  style={{ fontFamily: "'DM Mono', monospace" }}>Project</p>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: project.color }} />
                          {project.name} {project.type === "fixed" ? "(Fixed)" : `($${project.rate}/hr)`}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results */}
            {result ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 pt-4 border-t border-border/60"
              >
                {/* Time summary */}
                <div className="rounded-xl p-3 text-center"
                  style={{ background: "hsl(220,15%,97%)", border: "1px solid hsl(220,15%,90%)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1"
                    style={{ fontFamily: "'DM Mono', monospace" }}>Time · Billing</p>
                  <p className="text-base font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                    {result.timeDisplay}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {result.hoursDecimal} hrs × ${result.rate}/hr = ${result.grossUsd.toFixed(2)} gross
                  </p>
                </div>

                {/* Gross grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4"
                    style={{ background: "hsl(38,92%,50%,0.08)", border: "1px solid hsl(38,92%,50%,0.2)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1"
                      style={{ fontFamily: "'DM Mono', monospace" }}>Gross USD</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: "'Syne', sans-serif" }}>
                      ${result.grossUsd.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl p-4"
                    style={{ background: "hsl(220,15%,97%)", border: "1px solid hsl(220,15%,90%)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1"
                      style={{ fontFamily: "'DM Mono', monospace" }}>Gross INR</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: "'Syne', sans-serif" }}>
                      ₹{result.grossInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2"
                    style={{ fontFamily: "'DM Mono', monospace" }}>Deductions Breakdown</p>
                  <div className="rounded-xl overflow-hidden border border-border/60">
                    {[
                      { label: `Service Fee (${deductions?.serviceFee}%)`, value: result.deductions.serviceFee },
                      { label: `TDS (${deductions?.tds}%)`, value: result.deductions.tds },
                      { label: `GST (${deductions?.gst}% on service fee)`, value: result.deductions.gst },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center px-4 py-2.5 border-b border-border/40 last:border-0"
                        style={{ background: i % 2 === 0 ? "hsl(220,15%,98%)" : "white" }}>
                        <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {item.label}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-destructive"
                          style={{ fontFamily: "'DM Mono', monospace" }}>
                          −${item.value.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-4 py-3"
                      style={{ background: "hsl(220,15%,95%)" }}>
                      <span className="text-xs font-bold" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Total Deductions
                      </span>
                      <span className="text-sm font-bold tabular-nums text-destructive"
                        style={{ fontFamily: "'DM Mono', monospace" }}>
                        −${result.deductions.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Net earnings */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4"
                    style={{ background: "hsl(155,60%,38%,0.08)", border: "1px solid hsl(155,60%,38%,0.2)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1"
                      style={{ fontFamily: "'DM Mono', monospace" }}>Net USD</p>
                    <p className="text-2xl font-bold tabular-nums"
                      style={{ fontFamily: "'Syne', sans-serif", color: "hsl(155,60%,38%)" }}>
                      ${result.netUsd.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl p-4"
                    style={{ background: "hsl(155,60%,38%,0.08)", border: "1px solid hsl(155,60%,38%,0.2)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1"
                      style={{ fontFamily: "'DM Mono', monospace" }}>Net INR</p>
                    <p className="text-2xl font-bold tabular-nums"
                      style={{ fontFamily: "'Syne', sans-serif", color: "hsl(155,60%,38%)" }}>
                      ₹{result.netInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-center text-muted-foreground"
                  style={{ fontFamily: "'DM Mono', monospace" }}>
                  Exchange Rate: 1 USD = ₹{result.exchangeRate.toFixed(2)}
                </p>
              </motion.div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Calculator className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Enter time (H.MM format) and select a project to see calculations
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
