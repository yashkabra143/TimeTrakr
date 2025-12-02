import { useState } from "react";
import { format } from "date-fns";
import { useWithdrawals, useCreateWithdrawal, useUpdateWithdrawalStatus, useDeleteWithdrawal, useTimeEntries, useCurrencySettings } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, CheckCircle, Calendar as CalendarIcon, Wallet } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const formSchema = z.object({
    netEarnings: z.coerce.number().min(0.01, "Amount must be at least 0.01"),
    transactionFee: z.coerce.number().default(0.99),
    withdrawalDate: z.coerce.date({ required_error: "Withdrawal date is required" }),
    notes: z.string().optional(),
});

export default function History() {
    const { data: withdrawals = [], isLoading: isLoadingWithdrawals } = useWithdrawals();
    const { data: timeEntries = [], isLoading: isLoadingEntries } = useTimeEntries();
    const { data: currencySettings } = useCurrencySettings();

    const createWithdrawal = useCreateWithdrawal();
    const updateStatus = useUpdateWithdrawalStatus();
    const deleteWithdrawal = useDeleteWithdrawal();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);

    // Calculate Available Balance
    const totalEarnings = timeEntries.reduce((sum, entry) => sum + (entry.netUsd || 0), 0);
    const totalWithdrawn = withdrawals.reduce((sum, withdrawal) => sum + (withdrawal.netEarnings || 0), 0);
    const availableBalance = Math.max(0, totalEarnings - totalWithdrawn);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            netEarnings: 0,
            transactionFee: 0.99,
            withdrawalDate: new Date(),
            notes: "",
        },
    });

    const watchedNetEarnings = form.watch("netEarnings");
    const watchedTransactionFee = form.watch("transactionFee");
    const calculatedWithdrawalAmount = Math.max(0, (watchedNetEarnings || 0) - (watchedTransactionFee || 0));

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            // Prevent withdrawing more than available
            if (values.netEarnings > availableBalance + 0.01) { // small buffer for float precision
                toast({
                    title: "Insufficient Funds",
                    description: `You can only withdraw up to $${availableBalance.toFixed(2)}`,
                    variant: "destructive",
                });
                return;
            }

            const withdrawalAmount = values.netEarnings - values.transactionFee;

            await createWithdrawal.mutateAsync({
                netEarnings: values.netEarnings,
                transactionFee: values.transactionFee,
                withdrawalAmount,
                withdrawalDate: values.withdrawalDate,
                paymentStatus: "pending",
                notes: values.notes || "",
            });

            toast({
                title: "Withdrawal Created",
                description: `Withdrawal of $${withdrawalAmount.toFixed(2)} has been logged.`,
            });

            form.reset({
                netEarnings: 0,
                transactionFee: 0.99,
                withdrawalDate: new Date(),
                notes: "",
            });
            setOpen(false);
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "Failed to create withdrawal. Please try again.",
                variant: "destructive",
            });
        }
    }

    const handleStatusUpdate = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === "pending" ? "received" : "pending";
        try {
            await updateStatus.mutateAsync({ id, status: newStatus });
            toast({
                title: "Status Updated",
                description: `Payment status changed to ${newStatus}.`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update status.",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this withdrawal?")) return;

        try {
            await deleteWithdrawal.mutateAsync(id);
            toast({
                title: "Withdrawal Deleted",
                description: "The withdrawal record has been removed.",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete withdrawal.",
                variant: "destructive",
            });
        }
    };

    const isLoading = isLoadingWithdrawals || isLoadingEntries;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-heading">Withdrawal History</h1>
                    <p className="text-muted-foreground">Track your payment withdrawals and transaction fees</p>
                </div>

                <div className="flex items-center gap-4">
                    <Card className="bg-primary/5 border-primary/20 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-full text-primary">
                                <Wallet className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Available Balance</p>
                                <p className="text-xl font-bold font-heading text-primary">${availableBalance.toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button size="lg" className="shadow-lg shadow-primary/20 h-full">
                                <Plus className="mr-2 h-4 w-4" />
                                New Withdrawal
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Create Withdrawal</DialogTitle>
                                <DialogDescription>
                                    Record a new withdrawal. Available: <span className="font-bold text-primary">${availableBalance.toFixed(2)}</span>
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="netEarnings"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Withdrawal Amount (USD)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        {...field}
                                                        onChange={e => field.onChange(parseFloat(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="transactionFee"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Transaction Fee (USD)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.99"
                                                        {...field}
                                                        onChange={e => field.onChange(parseFloat(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm text-muted-foreground">Amount to Receive</p>
                                            <div className="text-right">
                                                <p className="text-2xl font-bold text-green-600">${calculatedWithdrawalAmount.toFixed(2)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    ≈ ₹{(calculatedWithdrawalAmount * (currencySettings?.usdToInr || 84.0)).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground text-right border-t border-border/50 pt-2 mt-2">
                                            {watchedNetEarnings?.toFixed(2) || "0.00"} - {watchedTransactionFee?.toFixed(2) || "0.00"} = {calculatedWithdrawalAmount.toFixed(2)}
                                        </p>
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="withdrawalDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Withdrawal Date</FormLabel>
                                                <FormControl>
                                                    <div className="relative cursor-pointer">
                                                        <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                                                        <Input
                                                            type="date"
                                                            className="pl-9 [&::-webkit-calendar-picker-indicator]:opacity-0 cursor-pointer"
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
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Notes (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Payment reference, bank details, etc." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Button type="submit" className="w-full" disabled={createWithdrawal.isPending}>
                                        {createWithdrawal.isPending ? "Creating..." : "Create Withdrawal"}
                                    </Button>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Withdrawals</CardTitle>
                    <CardDescription>
                        View and manage your withdrawal history
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-center py-8 text-muted-foreground">Loading withdrawals...</p>
                    ) : withdrawals.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <p className="text-sm font-medium">No withdrawals yet</p>
                            <p className="text-xs mt-1">Create your first withdrawal to start tracking</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {withdrawals.map((withdrawal) => (
                                <div
                                    key={withdrawal.id}
                                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <p className="font-medium">
                                                    {format(new Date(withdrawal.withdrawalDate), "PPP")}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Net: ${withdrawal.netEarnings.toFixed(2)} - Fee: ${withdrawal.transactionFee.toFixed(2)}
                                                </p>
                                                {withdrawal.notes && (
                                                    <p className="text-xs text-muted-foreground mt-1">{withdrawal.notes}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-xl font-bold text-green-600">
                                                ${withdrawal.withdrawalAmount.toFixed(2)}
                                            </p>
                                            <Badge
                                                variant={withdrawal.paymentStatus === "received" ? "default" : "secondary"}
                                                className="mt-1"
                                            >
                                                {withdrawal.paymentStatus === "received" ? "Received" : "Pending"}
                                            </Badge>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={() => handleStatusUpdate(withdrawal.id, withdrawal.paymentStatus)}
                                                title={withdrawal.paymentStatus === "pending" ? "Mark as Received" : "Mark as Pending"}
                                                onContextMenu={(e) => e.preventDefault()}
                                            >
                                                <CheckCircle className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={() => handleDelete(withdrawal.id)}
                                                title="Delete Withdrawal"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div >
    );
}
