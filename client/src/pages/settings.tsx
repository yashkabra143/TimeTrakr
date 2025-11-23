import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Download, Upload, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const projectSchema = z.object({
  projects: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required"),
    rate: z.coerce.number().min(0, "Rate must be positive"),
    color: z.string(),
  })),
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
  const { projects, deductions, currency, updateProject, updateDeductions, updateCurrency, entries, resetData, importData } = useStore();
  const { toast } = useToast();

  // Project Form
  const projectForm = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: { projects },
  });

  // Deduction Form
  const deductionForm = useForm({
    resolver: zodResolver(deductionSchema),
    defaultValues: {
      serviceFee: deductions.serviceFee,
      tds: deductions.tds,
      gst: deductions.gst,
      transferFee: deductions.transferFee,
    },
  });

  // Currency Form
  const currencyForm = useForm({
    resolver: zodResolver(currencySchema),
    defaultValues: { usdToInr: currency.usdToInr },
  });

  function onProjectSubmit(data: z.infer<typeof projectSchema>) {
    data.projects.forEach(p => updateProject(p.id, p));
    toast({ title: "Projects Updated", description: "Your project settings have been saved." });
  }

  function onDeductionSubmit(data: z.infer<typeof deductionSchema>) {
    updateDeductions(data);
    toast({ title: "Deductions Updated", description: "Tax and fee settings saved." });
  }

  function onCurrencySubmit(data: z.infer<typeof currencySchema>) {
    updateCurrency(data.usdToInr);
    toast({ title: "Currency Updated", description: `Exchange rate set to ₹${data.usdToInr}` });
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

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = (e) => {
        if(e.target?.result) {
          try {
            const parsedData = JSON.parse(e.target.result as string);
            importData(parsedData);
            toast({ title: "Import Successful", description: "Data has been restored." });
            // Reload page to reflect changes simply
            setTimeout(() => window.location.reload(), 1000);
          } catch (error) {
            toast({ title: "Import Failed", description: "Invalid JSON file.", variant: "destructive" });
          }
        }
      };
    }
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
              <CardTitle>Project Configuration</CardTitle>
              <CardDescription>Set names and hourly rates for your 3 main projects.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...projectForm}>
                <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-4">
                  {projectForm.watch("projects").map((field, index) => (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-4 border rounded-lg bg-muted/20">
                      <div className="col-span-1 md:col-span-1 flex justify-center pb-3">
                         <div className="w-6 h-6 rounded-full" style={{ backgroundColor: field.color }} />
                      </div>
                      <div className="col-span-11 md:col-span-6">
                        <FormField
                          control={projectForm.control}
                          name={`projects.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Project Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
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
                                <Input type="number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <Button type="submit">
                      <Save className="w-4 h-4 mr-2" />
                      Save Projects
                    </Button>
                  </div>
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
                            <Input type="number" step="0.1" {...field} />
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
                            <Input type="number" step="0.01" {...field} />
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
                            <Input type="number" step="0.1" {...field} />
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
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormDescription>Flat fee deducted during transfer.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full">Save Deductions</Button>
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
                        ₹{currency.usdToInr}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">1 USD = {currency.usdToInr} INR</p>
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
                               <Input type="number" step="0.01" className="pl-8" {...field} />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Update this manually based on current market rates.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" variant="secondary">Update Rate</Button>
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
                <CardDescription>Export your data to JSON or import a backup.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={handleExport} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Export Data
                  </Button>
                  <div className="flex-1 relative">
                    <Button variant="outline" className="w-full cursor-pointer">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Data
                    </Button>
                    <Input 
                      type="file" 
                      accept=".json" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={handleImport}
                    />
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="pt-4">
                  <h4 className="text-sm font-medium text-destructive mb-2">Danger Zone</h4>
                  <Button variant="destructive" onClick={() => {
                    if(confirm("Are you sure you want to delete all data? This cannot be undone.")) {
                      resetData();
                      toast({ title: "Data Reset", description: "All entries have been deleted." });
                    }
                  }}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All Data
                  </Button>
                </div>
              </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
