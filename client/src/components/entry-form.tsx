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
import { useProjects, useDeductions, useCurrencySettings, useCreateTimeEntry } from "@/lib/hooks";

const formSchema = z.object({
  projectId: z.string().min(1, "Please select a project"),
  hours: z.coerce.number().min(0.1, "Hours must be at least 0.1"),
  date: z.date({
    required_error: "A date of entry is required.",
  }),
  description: z.string().optional(),
});

export function EntryForm({ onSuccess, className }: { onSuccess?: () => void, className?: string }) {
  const { data: projects = [] } = useProjects();
  const { data: deductions } = useDeductions();
  const { data: currency } = useCurrencySettings();
  const createEntry = useCreateTimeEntry();
  const { toast } = useToast();
  const [calculated, setCalculated] = useState({ gross: 0, netUsd: 0, netInr: 0 });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hours: 0,
      date: new Date(),
      description: "",
    },
  });

  const watchedHours = form.watch("hours");
  const watchedProjectId = form.watch("projectId");

  useEffect(() => {
    const project = projects.find(p => p.id === watchedProjectId);
    if (project && watchedHours && deductions && currency) {
      const gross = watchedHours * project.rate;
      const serviceFeePercent = deductions.serviceFee || 0;
      const serviceAmt = gross * (serviceFeePercent / 100);
      const tdsPercent = deductions.tds || 0;
      const tdsAmt = gross * (tdsPercent / 100);
      const gstPercent = deductions.gst || 0;
      const gstAmt = serviceAmt * (gstPercent / 100);
      const transferAmt = deductions.transferFee || 0;
      const netBeforeTransfer = gross - serviceAmt - tdsAmt - gstAmt;
      const netUsd = Math.max(0, netBeforeTransfer - transferAmt);
      const netInr = netUsd * currency.usdToInr;
      setCalculated({ gross, netUsd, netInr });
    } else {
      setCalculated({ gross: 0, netUsd: 0, netInr: 0 });
    }
  }, [watchedHours, watchedProjectId, projects, deductions, currency]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await createEntry.mutateAsync({
        projectId: values.projectId,
        hours: values.hours,
        date: values.date,
        description: values.description,
      });

      toast({
        title: "Entry Added",
        description: `Logged ${values.hours} hours for ${projects.find(p => p.id === values.projectId)?.name}`,
      });

      form.reset({
        projectId: values.projectId,
        hours: 0,
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
                            {project.name} (${project.rate}/hr)
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hours Worked</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Calculator className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input data-testid="input-hours" type="number" step="0.25" placeholder="0.00" className="pl-9" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input data-testid="input-description" placeholder="What did you work on?" {...field} />
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
          {createEntry.isPending ? "Logging..." : "Log Time Entry"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </Form>
  );
}
