import { useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useProjects, useDeductions, useCurrencySettings } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { parseTimeInput, minutesToHoursDecimal, formatMinutesReadable } from "@shared/time";

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

    // Parse time input as H.MM format (matching UI help text)
    let parsedTime;
    try {
      parsedTime = parseTimeInput(timeInput, { format: "hm" });
    } catch (err) {
      return null;
    }

    const minutes = parsedTime.minutes;
    const hoursDecimal = minutesToHoursDecimal(minutes);
    const rate = selectedProject.rate;
    const grossUsd = hoursDecimal * rate;

    // Calculate deductions
    const serviceFeePercent = deductions.serviceFee || 0;
    const tdsPercent = deductions.tds || 0;
    const gstPercent = deductions.gst || 0;
    const transferFee = deductions.transferFee || 0;

    const serviceAmt = grossUsd * (serviceFeePercent / 100);
    const tdsAmt = grossUsd * (tdsPercent / 100);
    const gstAmt = serviceAmt * (gstPercent / 100);
    const transferAmt = transferFee;

    // Include transfer fee in total deductions (matching server calculation)
    const totalDeductions = serviceAmt + tdsAmt + gstAmt + transferAmt;
    const netUsd = Math.max(0, grossUsd - totalDeductions);

    const exchangeRate = currency.usdToInr || 0;
    const grossInr = grossUsd * exchangeRate;
    const netInr = netUsd * exchangeRate;

    return {
      minutes,
      hoursDecimal,
      timeDisplay: formatMinutesReadable(minutes),
      rate,
      grossUsd,
      grossInr,
      netUsd,
      netInr,
      deductions: {
        serviceFee: serviceAmt,
        tds: tdsAmt,
        gst: gstAmt,
        transfer: transferAmt,
        total: totalDeductions,
      },
      exchangeRate,
    };
  };

  const result = calculateEarnings();

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setOpen(true)}
          title="Open earnings calculator"
        >
          <Calculator className="w-4 h-4" />
          <span className="hidden sm:inline">Calculator</span>
        </Button>

        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Earnings Calculator</DialogTitle>
            <DialogDescription>
              Calculate your earnings with deductions breakdown
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Input Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="time-input">Time (H.MM format)</Label>
                <Input
                  id="time-input"
                  type="number"
                  placeholder="8.20"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  min="0"
                  step="0.01"
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Enter time as H.MM (minutes after decimal). Example: 8.20 = 8h 20m, 1.5 = 1h 50m
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project">Project</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger id="project">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} (${project.rate}/hr)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Section */}
            {result && (
              <div className="space-y-4 pt-6 border-t border-border">
                {/* Time Display */}
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Time Entered</p>
                  <p className="text-lg font-semibold">{result.timeDisplay}</p>
                </div>

                {/* Gross Earnings */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-accent/50">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Gross Earnings (USD)</p>
                      <p className="text-2xl font-bold">${result.grossUsd.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-accent/50">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Gross Earnings (INR)</p>
                      <p className="text-2xl font-bold">₹{result.grossInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Deductions Breakdown */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">Deductions Breakdown</h3>
                  <div className="space-y-2 bg-muted/50 rounded-lg p-4">
                    <div className="flex justify-between items-center text-sm">
                      <span>Service Fee ({deductions?.serviceFee}%)</span>
                      <span className="font-medium">${result.deductions.serviceFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>TDS ({deductions?.tds}%)</span>
                      <span className="font-medium">${result.deductions.tds.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>GST ({deductions?.gst}%)</span>
                      <span className="font-medium">${result.deductions.gst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Transfer Fee</span>
                      <span className="font-medium">${result.deductions.transfer.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border pt-2 mt-2 flex justify-between items-center text-sm font-semibold">
                      <span>Total Deductions</span>
                      <span>${result.deductions.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Earnings */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Net Earnings (USD)</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        ${result.netUsd.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Net Earnings (INR)</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        ₹{result.netInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Exchange Rate Info */}
                <div className="text-xs text-muted-foreground text-center pt-2">
                  Exchange Rate: 1 USD = ₹{result.exchangeRate.toFixed(2)}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!result && (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">Enter time (H.MM format) and select a project to see calculations</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
