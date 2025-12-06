import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Calculator, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

import { useEffect, useState } from "react";
import { useProjects, useDeductions, useCurrencySettings, useCreateTimeEntry, useTimeEntries } from "@/lib/hooks";
import { formatMinutesReadable, minutesToHoursDecimal, parseTimeInput } from "@shared/time";

const formSchema = z.object({
  projectId: z.string().min(1, "Please select a project"),
  hours: z.coerce.number().min(0, "Hours must be positive"),
  amount: z.coerce.number().optional(),
  date: z.date({
    required_error: "A date of entry is required.",
  }),
  description: z.string().optional(),
});

export function EntryForm({ onSuccess, className }: { onSuccess?: () => void, className?: string }) {
  const { data: projects = [] } = useProjects();
  const { data: deductions } = useDeductions();
  const { data: currency } = useCurrencySettings();
  const { data: entries = [] } = useTimeEntries();
  const createEntry = useCreateTimeEntry();
  const { toast } = useToast();
  const [calculated, setCalculated] = useState({ gross: 0, netUsd: 0, netInr: 0 });
  const [remainingBudget, setRemainingBudget] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hours: 0,
      amount: 0,
      date: new Date(),
      description: "",
    },
  });

  const watchedHours = form.watch("hours");
  const watchedAmount = form.watch("amount");
  const watchedProjectId = form.watch("projectId");

  useEffect(() => {
    const project = projects.find(p => p.id === watchedProjectId);
    if (project && deductions && currency) {
      let gross = 0;

      if (project.type === "fixed") {
        // Calculate remaining budget
        const projectEntries = entries.filter(e => e.projectId === project.id);
        const paidAmount = projectEntries.reduce((sum, e) => sum + (e.grossUsd || 0), 0);
        const remaining = Math.max(0, project.rate - paidAmount);
        setRemainingBudget(remaining);

        if (!watchedAmount) {
          // Leave empty to avoid overwriting user input
        }

        gross = watchedAmount || 0;
      } else {
        try {
          // Parse as H.MM format (matching UI help text)
          const parsed = parseTimeInput(watchedHours ?? 0, { format: "hm" });
          const hoursDecimal = minutesToHoursDecimal(parsed.minutes);
          gross = hoursDecimal * project.rate;
        } catch (err) {
          console.error("[ENTRY FORM] Failed to parse hours", err);
          gross = 0;
        }
      }

      // Calculate deductions
      const serviceFeePercent = deductions.serviceFee || 0;
      const tdsPercent = deductions.tds || 0;
      const gstPercent = deductions.gst || 0;
      const transferFee = deductions.transferFee || 0;

      const serviceAmt = gross * (serviceFeePercent / 100);
      const tdsAmt = gross * (tdsPercent / 100);
      const gstAmt = serviceAmt * (gstPercent / 100);

      const totalDeductions = serviceAmt + tdsAmt + gstAmt;
      const netUsd = Math.max(0, gross - totalDeductions);
      const netInr = netUsd * currency.usdToInr;

      setCalculated({ gross, netUsd, netInr });
    } else {
      setCalculated({ gross: 0, netUsd: 0, netInr: 0 });
    }
  }, [watchedHours, watchedAmount, watchedProjectId, projects, deductions, currency, entries]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const project = projects.find(p => p.id === values.projectId);
      if (!project) return;

      const isFixed = project.type === "fixed";
      let parsedMinutes = 0;
      let parsedFormat: "hm" | "fractional" = "hm";

      // Validate budget for fixed projects
      if (isFixed && values.amount) {
        const projectEntries = entries.filter(e => e.projectId === project.id);
        const paidAmount = projectEntries.reduce((sum, e) => sum + (e.grossUsd || 0), 0);
        const remaining = Math.max(0, project.rate - paidAmount);

        if (values.amount > remaining) {
          toast({
            title: "Budget Exceeded",
            description: `Milestone amount ($${values.amount}) exceeds remaining budget ($${remaining.toFixed(2)}). Please enter an amount ≤ $${remaining.toFixed(2)}.`,
            variant: "destructive",
          });
          return;
        }
      }

      if (!isFixed) {
        try {
          // Parse as H.MM format (matching UI help text)
          const parsed = parseTimeInput(values.hours ?? 0, { format: "hm" });
          parsedMinutes = parsed.minutes;
          parsedFormat = "hm";
        } catch (err) {
          toast({
            title: "Invalid time",
            description: "Please enter time as H.MM (e.g., 1.50 for 1h 50m).",
            variant: "destructive",
          });
          console.error("[ENTRY FORM] Parse error", err);
          return;
        }
      }

      await createEntry.mutateAsync({
        projectId: values.projectId,
        minutes: isFixed ? 0 : parsedMinutes,
        inputFormat: parsedFormat,
        rawInput: values.hours,
        manualGrossAmount: isFixed ? values.amount : undefined,
        date: values.date,
        description: values.description,
      });

      toast({
        title: isFixed ? "Milestone Submitted" : "Entry Added",
        description: isFixed
          ? `Submitted milestone of $${values.amount} for ${project.name}`
          : `Logged ${formatMinutesReadable(parsedMinutes)} for ${project.name}`,
      });

      form.reset({
        projectId: values.projectId,
        hours: 0,
        amount: 0,
        date: new Date(),
        description: "",
      });

      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add entry. Please try again.",
        variant: "destructive",
      });
    }
  }

  const selectedProject = projects.find(p => p.id === watchedProjectId);
  const isFixedProject = selectedProject?.type === "fixed";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={cn("space-y-4 md:space-y-6", className)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-project">
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                            {project.name} {project.type === "fixed" ? "(Fixed)" : `($${project.rate}/hr)`}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isFixedProject && selectedProject ? (
              <>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 rounded-lg border border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Budget</p>
                    <p className="text-lg font-semibold">${selectedProject.rate.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Remaining</p>
                    <p className={`text-lg font-semibold ${remainingBudget < 0 ? "text-destructive" : "text-green-600"}`}>
                      ${remainingBudget.toFixed(2)}
                    </p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Milestone Amount ($)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="100.00"
                            className="pl-7"
                            max={remainingBudget > 0 ? remainingBudget : undefined}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                          />
                        </div>
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum: ${remainingBudget.toFixed(2)}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <FormField
                control={form.control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours Worked</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calculator className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input data-testid="input-hours" type="number" step="0.01" placeholder="1.50" className="pl-9" {...field} />
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">Enter time as H.MM (minutes after the decimal). Example: 1.5 = 1h 50m, 2.25 = 2h 25m.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isFixedProject ? "Submission Date" : "Date"}</FormLabel>
                  <FormControl>
                    <div className="relative cursor-pointer">
                      <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        type="date"
                        className="pl-9 [&::-webkit-calendar-picker-indicator]:opacity-0 cursor-pointer"
                        data-testid="input-date"
                        value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : undefined;
                          field.onChange(date);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isFixedProject ? "Milestone Name / Description" : "Description (Optional)"}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-description" placeholder={isFixedProject ? "e.g. Frontend Implementation" : "What did you work on?"} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="bg-muted/30 rounded-xl p-6 space-y-4 border border-border/50 flex flex-col justify-center">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-2">Estimated Earnings</h3>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Gross Amount</p>
              <p className="text-2xl font-bold font-heading" data-testid="text-gross">${calculated.gross.toFixed(2)}</p>
            </div>

            <div className="space-y-1 pt-2 border-t border-border/50">
              <p className="text-sm text-muted-foreground">Net USD (after all deductions)</p>
              <p className="text-2xl font-bold font-heading text-primary" data-testid="text-net-usd">${calculated.netUsd.toFixed(2)}</p>
            </div>

            <div className="space-y-1 pt-2 border-t border-border/50">
              <p className="text-sm text-muted-foreground">Net INR (₹{currency?.usdToInr || 0}/$)</p>
              <p className="text-2xl font-bold font-heading text-green-600" data-testid="text-net-inr">₹{calculated.netInr.toFixed(0)}</p>
            </div>
          </div>
        </div>

        <Button type="submit" data-testid="button-submit" className="w-full h-12 text-base" size="lg" disabled={createEntry.isPending}>
          {createEntry.isPending ? "Logging..." : (isFixedProject ? "Submit Milestone" : "Log Time Entry")}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </Form >
  );
}
