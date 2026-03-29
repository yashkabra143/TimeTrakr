import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useProjects, useDeductions, useCurrencySettings, useUpdateProject, useUpdateDeductions, useUpdateCurrencySettings, useTimeEntries, useCreateProject, useDeleteProject, useCurrentUser, useUpdateUser, useSendTestReminder, useIsPro } from "@/lib/hooks";
import { useEffect, useState } from "react";
import { UpgradeModal } from "@/components/upgrade-modal";
import { motion } from "framer-motion";
import { Save, Download, Plus, RefreshCw, Clock, Briefcase, Pencil, Trash2, Settings as SettingsIcon, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const PROJECT_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#06b6d4", "#f97316", "#14b8a6", "#6366f1", "#a855f7",
];

const newProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  rate: z.coerce.number().min(0, "Rate must be 0 or greater"),
  color: z.string(),
  type: z.enum(["hourly", "fixed"]).default("hourly"),
});

const projectSchema = z.object({
  projects: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required"),
    rate: z.coerce.number().min(0),
    color: z.string(),
    type: z.enum(["hourly", "fixed"]).default("hourly"),
    createdAt: z.any().optional(),
  })),
});

const deductionSchema = z.object({
  serviceFee: z.coerce.number().min(0).max(100),
  tds: z.coerce.number().min(0).max(100),
  gst: z.coerce.number().min(0).max(100),
  transferFee: z.coerce.number().min(0),
  isGstRegistered: z.boolean().default(false),
  taxSlabRate: z.coerce.number().min(0).max(100),
});

const currencySchema = z.object({
  usdToInr: z.coerce.number().min(1),
});

type SectionTab = "general" | "financials" | "data";

const TABS: { value: SectionTab; label: string }[] = [
  { value: "general",    label: "Projects" },
  { value: "financials", label: "Financials" },
  { value: "data",       label: "Data" },
];

const fade = (i = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] } },
});

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-border/40">
        <h3 className="text-sm font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>{description}</p>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function TaxRemindersCard() {
  const { data: me } = useCurrentUser();
  const updateUser = useUpdateUser();
  const sendTest = useSendTestReminder();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const isPro = useIsPro();

  useEffect(() => {
    if (me?.user) setEnabled(me.user.reminderEnabled ?? false);
  }, [me]);

  async function handleSave() {
    try {
      await updateUser.mutateAsync({ reminderEnabled: enabled });
      toast({ title: "Reminder preferences saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save preferences.", variant: "destructive" });
    }
  }

  async function handleTest() {
    try {
      await sendTest.mutateAsync();
      toast({ title: "Test email sent!", description: `Check ${me?.user?.email}` });
    } catch (e: any) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    }
  }

  const hasEmail = !!me?.user?.email;

  return (
    <>
    <SectionCard
      title="Tax Reminders"
      description="Get email alerts before advance tax due dates (Jun 15, Sep 15, Dec 15, Mar 15)."
    >
      <div className="space-y-5">
        {/* Email destination */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-background">
          <Bell className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>Reminder email</p>
            <p className="text-xs text-muted-foreground truncate" style={{ fontFamily: "'DM Mono', monospace" }}>
              {hasEmail ? me.user.email : "No email on account — add one in Profile first"}
            </p>
          </div>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>Enable email reminders</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sent 7 days before, 3 days before, and on the due date.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={!hasEmail}
            onClick={() => {
              if (!isPro) { setShowUpgrade(true); return; }
              setEnabled(!enabled);
            }}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
              enabled ? "bg-primary" : "bg-muted"
            )}
          >
            <span className={cn(
              "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
              enabled ? "translate-x-5" : "translate-x-0"
            )} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
          <motion.button
            type="button"
            onClick={handleTest}
            disabled={sendTest.isPending || !hasEmail || !enabled}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-semibold border border-border hover:bg-muted transition-colors disabled:opacity-50"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <Bell className="w-3.5 h-3.5" />
            {sendTest.isPending ? "Sending..." : "Send Test Email"}
          </motion.button>
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={updateUser.isPending || !hasEmail}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-semibold ml-auto disabled:opacity-50"
            style={{ fontFamily: "'Manrope', sans-serif", background: "hsl(38,92%,50%)", color: "hsl(228,25%,9%)" }}
          >
            <Save className="w-3.5 h-3.5" />
            {updateUser.isPending ? "Saving..." : "Save Preferences"}
          </motion.button>
        </div>
      </div>
    </SectionCard>
    <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} featureName="Tax Email Reminders" />
    </>
  );
}

export default function Settings() {
  const { data: projects = [] } = useProjects();
  const { data: deductions } = useDeductions();
  const { data: currency } = useCurrencySettings();
  const { data: entries = [] } = useTimeEntries();

  const updateProject = useUpdateProject();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const updateDeductions = useUpdateDeductions();
  const updateCurrency = useUpdateCurrencySettings();
  const { toast } = useToast();

  const [tab, setTab] = useState<SectionTab>("general");
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<{ id: string; name: string; rate: number; color: string; type: "hourly" | "fixed" } | null>(null);
  const [isFetchingRate, setIsFetchingRate] = useState(false);

  const newProjectForm = useForm({ resolver: zodResolver(newProjectSchema), defaultValues: { name: "", rate: 0, color: PROJECT_COLORS[0], type: "hourly" as "hourly" | "fixed" } });
  const projectForm = useForm({ resolver: zodResolver(projectSchema), defaultValues: { projects } });
  const deductionForm = useForm({ resolver: zodResolver(deductionSchema), defaultValues: deductions });
  const currencyForm = useForm({ resolver: zodResolver(currencySchema), defaultValues: { usdToInr: currency?.usdToInr || 84 } });

  useEffect(() => { if (projects.length > 0) projectForm.reset({ projects }); }, [projects]);
  useEffect(() => { if (deductions) deductionForm.reset(deductions); }, [deductions]);
  useEffect(() => { if (currency) currencyForm.reset({ usdToInr: currency.usdToInr }); }, [currency]);

  async function onProjectSubmit(data: any) {
    for (const p of data.projects) {
      await updateProject.mutateAsync({ id: p.id, data: { name: p.name, rate: p.rate, color: p.color, type: p.type as any } });
    }
    toast({ title: "Projects Updated", description: "Your project settings have been saved." });
  }

  async function onNewProjectSubmit(data: z.infer<typeof newProjectSchema>) {
    try {
      await createProject.mutateAsync(data);
      newProjectForm.reset({ name: "", rate: 0, color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)], type: "hourly" as "hourly" | "fixed" });
      setIsAddProjectOpen(false);
      toast({ title: "Project Created", description: `${data.name} has been added.` });
    } catch {
      toast({ title: "Error", description: "Failed to create project.", variant: "destructive" });
    }
  }

  async function handleDeleteProject() {
    if (!deleteProjectId) return;
    try {
      await deleteProject.mutateAsync(deleteProjectId);
      setDeleteProjectId(null);
      toast({ title: "Project Deleted", description: "Project and entries removed." });
    } catch {
      toast({ title: "Error", description: "Failed to delete project.", variant: "destructive" });
    }
  }

  async function onDeductionSubmit(data: z.infer<typeof deductionSchema>) {
    await updateDeductions.mutateAsync(data);
    toast({ title: "Deductions Updated", description: "Tax and fee settings saved." });
  }

  async function onCurrencySubmit(data: z.infer<typeof currencySchema>) {
    await updateCurrency.mutateAsync({ usdToInr: data.usdToInr });
    toast({ title: "Currency Updated", description: `Rate set to ₹${data.usdToInr}` });
  }

  async function fetchLiveExchangeRate() {
    setIsFetchingRate(true);
    try {
      const res = await fetch("/api/exchange-rate/live");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).message || "Failed to fetch");
      const { rate } = data as { rate: unknown };
      if (typeof rate !== "number" || !isFinite(rate)) {
        throw new Error("Received an invalid exchange rate from the server.");
      }
      await updateCurrency.mutateAsync({ usdToInr: rate });
      currencyForm.setValue("usdToInr", rate);
      toast({ title: "Rate Updated", description: `Live rate: ₹${rate.toFixed(2)}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to fetch live rate.", variant: "destructive" });
    } finally {
      setIsFetchingRate(false);
    }
  }

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ projects, deductions, currency, entries }));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = "timeflow_backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const hourlyProjects = projectForm.watch("projects").filter(p => p.type === "hourly" || !p.type);
  const fixedProjects = projectForm.watch("projects").filter(p => p.type === "fixed");

  return (
    <div className="max-w-4xl mx-auto space-y-7 pb-12">

      {/* Header */}
      <motion.div {...fade(0)} className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "hsl(38,92%,50%)" }}>
          <SettingsIcon className="w-4 h-4" style={{ color: "hsl(228,25%,9%)" }} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>Configuration</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>Settings</h1>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div {...fade(1)}>
        <div className="inline-flex gap-1 p-1 rounded-xl border border-border/60" style={{ background: "hsl(220,15%,95%)" }}>
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className="px-5 h-8 rounded-lg text-xs font-semibold transition-all duration-200"
              style={{
                fontFamily: "'Manrope', sans-serif",
                background: tab === t.value ? "white" : "transparent",
                color: tab === t.value ? "hsl(228,25%,12%)" : "hsl(220,10%,48%)",
                boxShadow: tab === t.value ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Projects tab ── */}
      {tab === "general" && (
        <motion.div {...fade(2)} className="space-y-4">
          <SectionCard
            title="Project Configuration"
            description="Manage your freelance projects, rates, and contract types."
          >
            <Form {...projectForm}>
              <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-6">
                {projects.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="text-sm font-medium">No projects yet</p>
                    <p className="text-xs mt-1">Click "Add Project" to create your first project.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {[
                      { type: "hourly" as const, list: hourlyProjects, icon: Clock, label: "Hourly Projects", desc: "Billed by the hour" },
                      { type: "fixed" as const,  list: fixedProjects,  icon: Briefcase, label: "Fixed Price", desc: "Fixed budget contracts" },
                    ].map(section => (
                      <div key={section.type} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <section.icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                            {section.label}
                          </span>
                          <span className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded-full"
                            style={{ background: "hsl(220,15%,92%)", color: "hsl(220,10%,45%)", fontFamily: "'DM Mono', monospace" }}>
                            {section.list.length}
                          </span>
                        </div>

                        {section.list.length === 0 ? (
                          <p className="text-xs text-muted-foreground pl-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            No {section.type} projects.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {section.list.map((p) => {
                              const globalIndex = projects.findIndex(x => x.id === p.id);
                              return (
                                <div key={p.id}
                                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 hover:border-border transition-colors bg-background">
                                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>{p.name}</p>
                                    <p className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                                      {p.type === "hourly" ? `$${p.rate}/hr` : `$${p.rate} fixed`}
                                    </p>
                                  </div>
                                  <div className="flex gap-1">
                                    <button type="button"
                                      onClick={() => setEditingProject({ id: p.id, name: p.name, rate: p.rate, color: p.color, type: p.type as "hourly" | "fixed" })}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button type="button"
                                      onClick={() => setDeleteProjectId(p.id)}
                                      data-testid={`button-delete-project-${globalIndex}`}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-border/40">
                  <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
                    <DialogTrigger asChild>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-semibold border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Project
                      </motion.button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Project</DialogTitle>
                        <DialogDescription>Create a new project with a custom rate and color.</DialogDescription>
                      </DialogHeader>
                      <Form {...newProjectForm}>
                        <form onSubmit={newProjectForm.handleSubmit(onNewProjectSubmit)} className="space-y-4">
                          <FormField control={newProjectForm.control} name="name" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Project Name</FormLabel>
                              <FormControl><Input placeholder="Client name or project" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={newProjectForm.control} name="type" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contract Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="hourly">Hourly Rate</SelectItem>
                                  <SelectItem value="fixed">Fixed Price</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                {newProjectForm.watch("type") === "hourly" ? "Paid based on hours logged" : "Fixed amount regardless of hours"}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={newProjectForm.control} name="rate" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{newProjectForm.watch("type") === "fixed" ? "Contract Budget ($)" : "Hourly Rate ($)"}</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                                  <Input type="number" step="0.01" className="pl-7" placeholder="25.00" {...field} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={newProjectForm.control} name="color" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Project Color</FormLabel>
                              <FormControl>
                                <div className="flex gap-2 flex-wrap">
                                  {PROJECT_COLORS.map(c => (
                                    <button key={c} type="button" onClick={() => field.onChange(c)}
                                      className="w-7 h-7 rounded-full border-2 transition-all"
                                      style={{ backgroundColor: c, borderColor: field.value === c ? "hsl(228,25%,12%)" : "transparent", transform: field.value === c ? "scale(1.2)" : "scale(1)" }} />
                                  ))}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <DialogFooter>
                            <button type="button" onClick={() => setIsAddProjectOpen(false)}
                              className="px-4 h-9 rounded-xl text-xs font-semibold border border-border hover:bg-muted transition-colors"
                              style={{ fontFamily: "'Manrope', sans-serif" }}>
                              Cancel
                            </button>
                            <button type="submit" disabled={createProject.isPending}
                              className="px-4 h-9 rounded-xl text-xs font-semibold text-[hsl(228,25%,9%)] transition-colors"
                              style={{ fontFamily: "'Manrope', sans-serif", background: "hsl(38,92%,50%)" }}>
                              {createProject.isPending ? "Creating..." : "Create Project"}
                            </button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>

                  {projects.length > 0 && (
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      data-testid="button-save-projects"
                      className="flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-semibold"
                      style={{ fontFamily: "'Manrope', sans-serif", background: "hsl(38,92%,50%)", color: "hsl(228,25%,9%)" }}
                    >
                      <Save className="w-3.5 h-3.5" /> Save Projects
                    </motion.button>
                  )}
                </div>
              </form>
            </Form>
          </SectionCard>
        </motion.div>
      )}

      {/* ── Financials tab ── */}
      {tab === "financials" && (
        <motion.div {...fade(2)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deductions */}
          <SectionCard title="Deductions & Taxes" description="Set calculation logic for net income.">
            <Form {...deductionForm}>
              <form onSubmit={deductionForm.handleSubmit(onDeductionSubmit)} className="space-y-4">
                {[
                  { name: "serviceFee" as const, label: "Service Fee (%)", desc: "Platform fee on gross amount.", testid: "input-service-fee", step: "0.1" },
                  { name: "tds" as const, label: "TDS (%)", desc: "Tax Deducted at Source on gross.", testid: "input-tds", step: "0.01" },
                  { name: "gst" as const, label: "GST on Service Fee (%)", desc: "GST charged on the service fee.", testid: "input-gst", step: "0.1" },
                  { name: "transferFee" as const, label: "Transfer Fee ($)", desc: "Flat fee deducted during transfer.", testid: "input-transfer-fee", step: "0.01" },
                ].map(f => (
                  <FormField key={f.name} control={deductionForm.control} name={f.name} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>{f.label}</FormLabel>
                      <FormControl>
                        <Input type="number" step={f.step} {...field} data-testid={f.testid}
                          className="h-10 rounded-xl text-sm" />
                      </FormControl>
                      <FormDescription className="text-xs">{f.desc}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                ))}

                <div className="pt-2 border-t border-border/40 space-y-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>Tax Settings</p>

                  <FormField control={deductionForm.control} name="isGstRegistered" render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <div>
                          <FormLabel className="text-xs font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>GST Registered</FormLabel>
                          <FormDescription className="text-xs">I am registered under GST and collect GST from clients.</FormDescription>
                        </div>
                        <FormControl>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={field.value}
                            onClick={() => field.onChange(!field.value)}
                            className={cn(
                              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                              field.value ? "bg-primary" : "bg-muted"
                            )}
                          >
                            <span className={cn(
                              "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200",
                              field.value ? "translate-x-5" : "translate-x-0"
                            )} />
                          </button>
                        </FormControl>
                      </div>
                    </FormItem>
                  )} />

                  <FormField control={deductionForm.control} name="taxSlabRate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>Income Tax Slab Rate (%)</FormLabel>
                      <FormControl>
                        <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                          <SelectTrigger className="h-10 rounded-xl text-sm">
                            <SelectValue placeholder="Select slab" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0% — No tax</SelectItem>
                            <SelectItem value="5">5% — Up to ₹5L</SelectItem>
                            <SelectItem value="10">10% — New regime</SelectItem>
                            <SelectItem value="15">15% — New regime</SelectItem>
                            <SelectItem value="20">20% — Old regime ₹5–10L</SelectItem>
                            <SelectItem value="30">30% — Above ₹10L</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription className="text-xs">Used to estimate advance tax installments on the Tax page.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  data-testid="button-save-deductions"
                  className="w-full h-10 rounded-xl text-xs font-semibold"
                  style={{ fontFamily: "'Manrope', sans-serif", background: "hsl(38,92%,50%)", color: "hsl(228,25%,9%)" }}>
                  Save Deductions
                </motion.button>
              </form>
            </Form>
          </SectionCard>

          {/* Currency */}
          <SectionCard title="Currency Conversion" description="Set the USD to INR exchange rate.">
            <Form {...currencyForm}>
              <form onSubmit={currencyForm.handleSubmit(onCurrencySubmit)} className="space-y-5">
                {/* Rate display */}
                <div className="rounded-xl p-5 text-center" style={{ background: "hsl(38,92%,50%,0.06)", border: "1px solid hsl(38,92%,50%,0.15)" }}>
                  <p className="text-xs text-muted-foreground mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>Current Rate</p>
                  <p className="text-4xl font-bold text-primary" style={{ fontFamily: "'Syne', sans-serif" }}>
                    ₹{currency?.usdToInr || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "'DM Mono', monospace" }}>
                    1 USD = {currency?.usdToInr || 0} INR
                  </p>
                </div>

                <FormField control={currencyForm.control} name="usdToInr" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>Manual Exchange Rate</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">₹</span>
                        <Input type="number" step="0.01" className="pl-7 h-10 rounded-xl" {...field} data-testid="input-exchange-rate" />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">Update manually based on current market rates.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex gap-2">
                  <motion.button type="button" onClick={fetchLiveExchangeRate} disabled={isFetchingRate}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    data-testid="button-fetch-rate"
                    className="flex-1 h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-border hover:bg-muted transition-colors"
                    style={{ fontFamily: "'Manrope', sans-serif" }}>
                    <RefreshCw className={cn("w-3.5 h-3.5", isFetchingRate && "animate-spin")} />
                    {isFetchingRate ? "Fetching..." : "Fetch Live Rate"}
                  </motion.button>
                  <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    data-testid="button-save-currency"
                    className="flex-1 h-10 rounded-xl text-xs font-semibold"
                    style={{ fontFamily: "'Manrope', sans-serif", background: "hsl(38,92%,50%)", color: "hsl(228,25%,9%)" }}>
                    Update Rate
                  </motion.button>
                </div>
              </form>
            </Form>
          </SectionCard>

          {/* Tax Reminders — full width */}
          <div className="md:col-span-2">
            <TaxRemindersCard />
          </div>
        </motion.div>
      )}

      {/* ── Data tab ── */}
      {tab === "data" && (
        <motion.div {...fade(2)}>
          <SectionCard title="Backup & Restore" description="Export your data as JSON for safekeeping.">
            <motion.button onClick={handleExport}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              data-testid="button-export"
              className="flex items-center gap-2 px-5 h-10 rounded-xl text-xs font-semibold border border-border hover:bg-muted transition-colors"
              style={{ fontFamily: "'Manrope', sans-serif" }}>
              <Download className="w-3.5 h-3.5" /> Export Data
            </motion.button>
          </SectionCard>
        </motion.div>
      )}

      {/* Edit Project Dialog */}
      <Dialog open={editingProject !== null} onOpenChange={open => !open && setEditingProject(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update the project name, rate, color, or type.</DialogDescription>
          </DialogHeader>
          {editingProject && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: "'Manrope', sans-serif" }}>Project Name</label>
                <Input value={editingProject.name}
                  onChange={e => setEditingProject(p => p ? { ...p, name: e.target.value } : null)}
                  placeholder="Project name" className="rounded-xl h-10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {editingProject.type === "hourly" ? "Hourly Rate ($)" : "Fixed Budget ($)"}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                  <Input type="number" step="0.01" className="pl-7 rounded-xl h-10"
                    value={editingProject.rate}
                    onChange={e => setEditingProject(p => p ? { ...p, rate: parseFloat(e.target.value) || 0 } : null)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: "'Manrope', sans-serif" }}>Project Type</label>
                <select className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background h-10"
                  value={editingProject.type}
                  onChange={e => setEditingProject(p => p ? { ...p, type: e.target.value as "hourly" | "fixed" } : null)}>
                  <option value="hourly">Hourly</option>
                  <option value="fixed">Fixed Price</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: "'Manrope', sans-serif" }}>Color</label>
                <div className="flex gap-2 flex-wrap">
                  {PROJECT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditingProject(p => p ? { ...p, color: c } : null)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: editingProject.color === c ? "hsl(228,25%,12%)" : "transparent", transform: editingProject.color === c ? "scale(1.2)" : "scale(1)" }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <button onClick={() => setEditingProject(null)}
              className="px-4 h-9 rounded-xl text-xs font-semibold border border-border hover:bg-muted transition-colors"
              style={{ fontFamily: "'Manrope', sans-serif" }}>
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!editingProject) return;
                try {
                  await updateProject.mutateAsync({ id: editingProject.id, data: { name: editingProject.name, rate: editingProject.rate, color: editingProject.color, type: editingProject.type } });
                  toast({ title: "Project updated", description: `"${editingProject.name}" saved.` });
                  setEditingProject(null);
                } catch {
                  toast({ title: "Error", description: "Failed to update project.", variant: "destructive" });
                }
              }}
              disabled={updateProject.isPending}
              className="px-4 h-9 rounded-xl text-xs font-semibold"
              style={{ fontFamily: "'Manrope', sans-serif", background: "hsl(38,92%,50%)", color: "hsl(228,25%,9%)" }}>
              {updateProject.isPending ? "Saving..." : "Save Changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteProjectId !== null} onOpenChange={open => !open && setDeleteProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the project and all associated time entries. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
