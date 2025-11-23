import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Download, Upload, Trash2, Plus, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useProjects, useDeductions, useCurrencySettings, useUpdateProject, useUpdateDeductions, useUpdateCurrencySettings, useTimeEntries, useCreateProject, useDeleteProject } from "@/lib/hooks";
import { useEffect, useState } from "react";

// Predefined color palette for projects
const PROJECT_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#a855f7", // violet
];

const projectSchema = z.object({
  projects: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required"),
    rate: z.coerce.number().min(0, "Rate must be positive"),
    color: z.string(),
    createdAt: z.any().optional(),
  })),
});

const newProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  rate: z.coerce.number().min(0, "Rate must be 0 or greater"),
  color: z.string(),
});

const deductionSchema = z.object({
  serviceFee: z.coerce.number().min(0).max(100),
  tds: z.coerce.number().min(0).max(100),
  gst: z.coerce.number().min(0).max(100),
  transferFee: z.coerce.number().min(0),
});

const currencySchema = z.object({
  usdToInr: z.coerce.number().min(1),
});

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

  // State for dialogs
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [isFetchingRate, setIsFetchingRate] = useState(false);

  // New Project Form
  const newProjectForm = useForm({
    resolver: zodResolver(newProjectSchema),
    defaultValues: {
      name: "",
      rate: 0,
      color: PROJECT_COLORS[0],
    },
  });

  // Project Form
  const projectForm = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: { projects },
  });

  useEffect(() => {
    if (projects.length > 0) {
      projectForm.reset({ projects });
    }
  }, [projects]);

  // Deduction Form
  const deductionForm = useForm({
    resolver: zodResolver(deductionSchema),
    defaultValues: deductions,
  });

  useEffect(() => {
    if (deductions) {
      deductionForm.reset({
        serviceFee: deductions.serviceFee,
        tds: deductions.tds,
        gst: deductions.gst,
        transferFee: deductions.transferFee,
      });
    }
  }, [deductions]);

  // Currency Form
  const currencyForm = useForm({
    resolver: zodResolver(currencySchema),
    defaultValues: { usdToInr: currency?.usdToInr || 84 },
  });

  useEffect(() => {
    if (currency) {
      currencyForm.reset({ usdToInr: currency.usdToInr });
    }
  }, [currency]);

  async function onProjectSubmit(data: z.infer<typeof projectSchema>) {
    for (const p of data.projects) {
      await updateProject.mutateAsync({ id: p.id, data: { name: p.name, rate: p.rate, color: p.color } });
    }
    toast({ title: "Projects Updated", description: "Your project settings have been saved." });
  }

  async function onNewProjectSubmit(data: z.infer<typeof newProjectSchema>) {
    try {
      await createProject.mutateAsync(data);
      newProjectForm.reset({
        name: "",
        rate: 0,
        color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
      });
      setIsAddProjectOpen(false);
      toast({ title: "Project Created", description: `${data.name} has been added successfully.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to create project. Please try again.", variant: "destructive" });
    }
  }

  async function handleDeleteProject() {
    if (!deleteProjectId) return;

    try {
      await deleteProject.mutateAsync(deleteProjectId);
      setDeleteProjectId(null);
      toast({ title: "Project Deleted", description: "Project and associated entries have been removed." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete project. Please try again.", variant: "destructive" });
    }
  }

  async function onDeductionSubmit(data: z.infer<typeof deductionSchema>) {
    await updateDeductions.mutateAsync(data);
    toast({ title: "Deductions Updated", description: "Tax and fee settings saved." });
  }

  async function onCurrencySubmit(data: z.infer<typeof currencySchema>) {
    await updateCurrency.mutateAsync({ usdToInr: data.usdToInr });
    toast({ title: "Currency Updated", description: `Exchange rate set to ₹${data.usdToInr}` });
  }

  async function fetchLiveExchangeRate() {
    setIsFetchingRate(true);
    try {
      const response = await fetch('https://api.frankfurter.dev/latest?from=USD&to=INR');
      if (!response.ok) throw new Error('Failed to fetch exchange rate');

      const data = await response.json();
      const rate = data.rates.INR;

      // Update form and save to database
      await updateCurrency.mutateAsync({ usdToInr: rate });
      currencyForm.setValue('usdToInr', rate);

      toast({
        title: "Exchange Rate Updated",
        description: `Live rate fetched: ₹${rate.toFixed(2)} per USD`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch live rate. Please enter manually.",
        variant: "destructive"
      });
    } finally {
      setIsFetchingRate(false);
    }
  }

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ projects, deductions, currency, entries }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "timeflow_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-heading">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences, rates, and data.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General & Projects</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Project Configuration</CardTitle>
                  <CardDescription>Manage your freelance projects and hourly rates.</CardDescription>
                </div>
                <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Project
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Project</DialogTitle>
                      <DialogDescription>
                        Create a new project with a custom rate and color.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...newProjectForm}>
                      <form onSubmit={newProjectForm.handleSubmit(onNewProjectSubmit)} className="space-y-4">
                        <FormField
                          control={newProjectForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Project Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Client name or project" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={newProjectForm.control}
                          name="rate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hourly Rate ($)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="25.00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={newProjectForm.control}
                          name="color"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Project Color</FormLabel>
                              <FormControl>
                                <div className="flex gap-2 flex-wrap">
                                  {PROJECT_COLORS.map((color) => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() => field.onChange(color)}
                                      className={`w-8 h-8 rounded-full border-2 transition-all ${field.value === color ? 'border-primary scale-110' : 'border-transparent'
                                        }`}
                                      style={{ backgroundColor: color }}
                                    />
                                  ))}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsAddProjectOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">Create Project</Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...projectForm}>
                <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-4">
                  {projects.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No projects yet. Click "Add Project" to get started.</p>
                    </div>
                  ) : (
                    projectForm.watch("projects").map((field, index) => (
                      <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-4 border rounded-lg bg-muted/20">
                        <div className="col-span-1 md:col-span-1 flex justify-center pb-3">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: field.color }} />
                        </div>
                        <div className="col-span-11 md:col-span-5">
                          <FormField
                            control={projectForm.control}
                            name={`projects.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Project Name</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid={`input-project-name-${index}`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-12 md:col-span-3">
                          <FormField
                            control={projectForm.control}
                            name={`projects.${index}.rate`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Hourly Rate ($)</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} data-testid={`input-project-rate-${index}`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-12 md:col-span-2 flex justify-end pb-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setDeleteProjectId(field.id)}
                            data-testid={`button-delete-project-${index}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  {projects.length > 0 && (
                    <div className="flex justify-end">
                      <Button type="submit" data-testid="button-save-projects">
                        <Save className="w-4 h-4 mr-2" />
                        Save Projects
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Deductions & Taxes</CardTitle>
                <CardDescription>Set calculation logic for net income.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...deductionForm}>
                  <form onSubmit={deductionForm.handleSubmit(onDeductionSubmit)} className="space-y-4">
                    <FormField
                      control={deductionForm.control}
                      name="serviceFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Fee (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" {...field} data-testid="input-service-fee" />
                          </FormControl>
                          <FormDescription>Platform/Service fee on gross amount.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deductionForm.control}
                      name="tds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TDS (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} data-testid="input-tds" />
                          </FormControl>
                          <FormDescription>Tax Deducted at Source on gross.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deductionForm.control}
                      name="gst"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GST on Service Fee (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" {...field} data-testid="input-gst" />
                          </FormControl>
                          <FormDescription>GST charged on the service fee amount.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deductionForm.control}
                      name="transferFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transfer Fee ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} data-testid="input-transfer-fee" />
                          </FormControl>
                          <FormDescription>Flat fee deducted during transfer.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" data-testid="button-save-deductions">Save Deductions</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Currency Conversion</CardTitle>
                <CardDescription>Set the USD to INR exchange rate.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...currencyForm}>
                  <form onSubmit={currencyForm.handleSubmit(onCurrencySubmit)} className="space-y-6">
                    <div className="bg-primary/5 p-6 rounded-xl text-center">
                      <p className="text-sm text-muted-foreground mb-2">Current Rate</p>
                      <div className="text-4xl font-bold font-heading text-primary">
                        ₹{currency?.usdToInr || 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">1 USD = {currency?.usdToInr || 0} INR</p>
                    </div>

                    <FormField
                      control={currencyForm.control}
                      name="usdToInr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manual Exchange Rate</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                              <Input type="number" step="0.01" className="pl-8" {...field} data-testid="input-exchange-rate" />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Update this manually based on current market rates.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={fetchLiveExchangeRate}
                        disabled={isFetchingRate}
                        className="flex-1"
                        data-testid="button-fetch-rate"
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isFetchingRate ? 'animate-spin' : ''}`} />
                        {isFetchingRate ? 'Fetching...' : 'Fetch Live Rate'}
                      </Button>
                      <Button
                        type="submit"
                        variant="secondary"
                        className="flex-1"
                        data-testid="button-save-currency"
                      >
                        Update Rate
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Backup & Restore</CardTitle>
              <CardDescription>Export your data to JSON.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={handleExport} className="flex-1" data-testid="button-export">
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Project Confirmation Dialog */}
      <AlertDialog open={deleteProjectId !== null} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this project and all associated time entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
