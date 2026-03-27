import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Calculator, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useProjects, useDeductions, useCurrencySettings, useCreateTimeEntry, useTimeEntries } from "@/lib/hooks";
import { formatMinutesReadable } from "@shared/time";

const formSchema = z.object({
  projectId:   z.string().min(1, "Please select a project"),
  hours:       z.coerce.number().min(0.01, "Hours must be greater than 0").max(24, "Cannot exceed 24 hours").optional(),
  amount:      z.coerce.number().min(0).optional(),
  date:        z.date({ required_error: "A date is required." }),
  description: z.string().optional(),
});

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      style={{ fontFamily: "'Manrope', sans-serif" }}>
      {children}
    </span>
  );
}

export function EntryForm({ onSuccess, className }: { onSuccess?: () => void; className?: string }) {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: deductions, isLoading: deductionsLoading } = useDeductions();
  const { data: currency, isLoading: currencyLoading } = useCurrencySettings();
  const { data: entries = [] } = useTimeEntries();
  const createEntry = useCreateTimeEntry();
  const { toast } = useToast();
  const [calculated, setCalculated] = useState({ gross: 0, netUsd: 0, netInr: 0 });
  const [remainingBudget, setRemainingBudget] = useState(0);

  const isLoading = projectsLoading || deductionsLoading || currencyLoading;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { hours: undefined, amount: undefined, date: new Date(), description: "" },
  });

  const watchedHours = form.watch("hours");
  const watchedAmount = form.watch("amount");
  const watchedProjectId = form.watch("projectId");

  useEffect(() => {
    const project = projects.find(p => p.id === watchedProjectId);
    if (project && deductions && currency) {
      let gross = 0;
      if (project.type === "fixed") {
        const paid = entries.filter(e => e.projectId === project.id).reduce((s, e) => s + (e.grossUsd || 0), 0);
        setRemainingBudget(Math.max(0, project.rate - paid));
        gross = watchedAmount || 0;
      } else {
        gross = (Number(watchedHours) || 0) * project.rate;
      }
      const svcAmt = gross * ((deductions.serviceFee || 0) / 100);
      const tdsAmt = gross * ((deductions.tds || 0) / 100);
      const gstAmt = svcAmt * ((deductions.gst || 0) / 100);
      const netUsd = Math.max(0, gross - svcAmt - tdsAmt - gstAmt);
      setCalculated({ gross, netUsd, netInr: netUsd * currency.usdToInr });
    } else {
      setCalculated({ gross: 0, netUsd: 0, netInr: 0 });
    }
  }, [watchedHours, watchedAmount, watchedProjectId, projects, deductions, currency, entries]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const project = projects.find(p => p.id === values.projectId);
      if (!project) return;
      const isFixed = project.type === "fixed";

      if (isFixed && values.amount) {
        const paid = entries.filter(e => e.projectId === project.id).reduce((s, e) => s + (e.grossUsd || 0), 0);
        const remaining = Math.max(0, project.rate - paid);
        if (values.amount > remaining) {
          toast({ title: "Budget Exceeded", description: `Max: $${remaining.toFixed(2)}`, variant: "destructive" });
          return;
        }
      }

      let parsedMinutes = 0;
      if (!isFixed) {
        const hoursVal = Number(values.hours ?? 0);
        if (!hoursVal || hoursVal <= 0) {
          toast({ title: "Invalid time", description: "Enter hours. E.g. 1.30 = 1hr 30min.", variant: "destructive" });
          return;
        }
        parsedMinutes = Math.round(hoursVal * 60);
      }

      await createEntry.mutateAsync({
        projectId: values.projectId,
        minutes: isFixed ? 0 : parsedMinutes,
        inputFormat: "fractional",
        rawInput: values.hours,
        manualGrossAmount: isFixed ? values.amount : undefined,
        date: values.date,
        description: values.description,
      });

      toast({
        title: isFixed ? "Milestone Submitted" : "Entry Added",
        description: isFixed ? `$${values.amount} for ${project.name}` : `${formatMinutesReadable(parsedMinutes)} for ${project.name}`,
      });

      form.reset({ projectId: values.projectId, hours: undefined, amount: undefined, date: new Date(), description: "" });
      onSuccess?.();
    } catch {
      toast({ title: "Error", description: "Failed to add entry.", variant: "destructive" });
    }
  }

  const selectedProject = projects.find(p => p.id === watchedProjectId);
  const isFixed = selectedProject?.type === "fixed";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={cn("space-y-5", className)}>
        <div className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-5">

          {/* Left — fields */}
          <div className="space-y-4">
            {/* Project select */}
            <FormField control={form.control} name="projectId" render={({ field }) => (
              <FormItem>
                <FormLabel><FieldLabel>Project</FieldLabel></FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-project" className="h-10 rounded-xl">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                          {p.name} {p.type === "fixed" ? "(Fixed)" : `($${p.rate}/hr)`}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Fixed project — budget display + amount */}
            {isFixed && selectedProject ? (
              <>
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border border-border/50"
                  style={{ background: "hsl(220,15%,97%)" }}>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1"
                      style={{ fontFamily: "'DM Mono', monospace" }}>Total Budget</p>
                    <p className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                      ${selectedProject.rate.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1"
                      style={{ fontFamily: "'DM Mono', monospace" }}>Remaining</p>
                    <p className={cn("text-lg font-bold", remainingBudget <= 0 ? "text-destructive" : "text-emerald-600")}
                      style={{ fontFamily: "'Syne', sans-serif" }}>
                      ${remainingBudget.toFixed(2)}
                    </p>
                  </div>
                </div>

                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel><FieldLabel>Milestone Amount ($)</FieldLabel></FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                        <Input type="number" step="0.01" placeholder="100.00" className="pl-7 h-10 rounded-xl"
                          max={remainingBudget > 0 ? remainingBudget : undefined}
                          value={field.value || ""}
                          onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)} />
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Max: ${remainingBudget.toFixed(2)}
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            ) : (
              /* Hourly — hours input */
              <FormField control={form.control} name="hours" render={({ field }) => (
                <FormItem>
                  <FormLabel><FieldLabel>Hours Worked</FieldLabel></FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input data-testid="input-hours" type="number" step="0.01" placeholder="1.50"
                        className="pl-9 h-10 rounded-xl" inputMode="decimal" {...field} />
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    1.30 = 1 hr 30 min · 2.45 = 2 hr 45 min · 0.30 = 30 min
                  </p>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {/* Date */}
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel><FieldLabel>{isFixed ? "Submission Date" : "Date"}</FieldLabel></FormLabel>
                <FormControl>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                    <Input type="date" className="pl-9 h-10 rounded-xl cursor-pointer"
                      data-testid="input-date"
                      value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                      max={format(new Date(), "yyyy-MM-dd")}
                      onChange={e => field.onChange(e.target.value ? new Date(e.target.value + "T00:00:00") : undefined)} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel><FieldLabel>{isFixed ? "Milestone Name / Description" : "Description (Optional)"}</FieldLabel></FormLabel>
                <FormControl>
                  <Input data-testid="input-description" className="h-10 rounded-xl"
                    placeholder={isFixed ? "e.g. Frontend Implementation" : "What did you work on?"}
                    {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          {/* Right — earnings preview */}
          <div className="rounded-2xl border border-border/50 p-5 flex flex-col gap-4"
            style={{ background: "hsl(220,15%,97%)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
              style={{ fontFamily: "'DM Mono', monospace" }}>
              Estimated Earnings
            </p>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>Gross Amount</p>
              <p className="text-3xl font-bold tabular-nums" data-testid="text-gross"
                style={{ fontFamily: "'Syne', sans-serif" }}>
                ${calculated.gross.toFixed(2)}
              </p>
            </div>

            <div className="pt-3 border-t border-border/50 space-y-1">
              <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>Net USD (after deductions)</p>
              <p className="text-3xl font-bold tabular-nums text-primary" data-testid="text-net-usd"
                style={{ fontFamily: "'Syne', sans-serif" }}>
                ${calculated.netUsd.toFixed(2)}
              </p>
            </div>

            <div className="pt-3 border-t border-border/50 space-y-1">
              <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Net INR (₹{currency?.usdToInr || 0}/$)
              </p>
              <p className="text-3xl font-bold tabular-nums" data-testid="text-net-inr"
                style={{ fontFamily: "'Syne', sans-serif", color: "hsl(155,60%,38%)" }}>
                ₹{calculated.netInr.toFixed(0)}
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <motion.button
          type="submit"
          data-testid="button-submit"
          disabled={createEntry.isPending}
          whileHover={!createEntry.isPending ? { scale: 1.01, boxShadow: "0 6px 24px hsl(38,92%,50%,0.35)" } : {}}
          whileTap={!createEntry.isPending ? { scale: 0.98 } : {}}
          className="w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontFamily: "'Manrope', sans-serif",
            background: "hsl(38,92%,50%)",
            color: "hsl(228,25%,9%)",
            boxShadow: "0 4px 16px hsl(38,92%,50%,0.25)",
          }}
        >
          {createEntry.isPending ? "Logging..." : (isFixed ? "Submit Milestone" : "Log Time Entry")}
          {!createEntry.isPending && <ArrowRight className="w-4 h-4" />}
        </motion.button>
      </form>
    </Form>
  );
}
