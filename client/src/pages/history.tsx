import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { useWithdrawals, useCreateWithdrawal, useUpdateWithdrawalStatus, useDeleteWithdrawal, useTimeEntries, useCurrencySettings } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, CheckCircle, Calendar as CalendarIcon, Wallet, Download, ArrowUpDown, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const formSchema = z.object({
    netEarnings: z.coerce.number().min(0.01, "Amount must be at least 0.01"),
    transactionFee: z.coerce.number().default(0.99),
    withdrawalDate: z.coerce.date({ required_error: "Withdrawal date is required" }),
    notes: z.string().optional(),
});

type SortField = "date" | "amount" | "status";
type SortOrder = "asc" | "desc";

export default function History() {
    const { data: withdrawals = [], isLoading: isLoadingWithdrawals } = useWithdrawals();
    const { data: timeEntries = [], isLoading: isLoadingEntries } = useTimeEntries();
    const { data: currencySettings } = useCurrencySettings();

    const createWithdrawal = useCreateWithdrawal();
    const updateStatus = useUpdateWithdrawalStatus();
    const deleteWithdrawal = useDeleteWithdrawal();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [confirmStatusId, setConfirmStatusId] = useState<string | null>(null);
    const [confirmStatusValue, setConfirmStatusValue] = useState<string | null>(null);

    // Filter & Sort States
    const [statusFilter, setStatusFilter] = useState<"all" | "received" | "pending">("all");
    const [sortField, setSortField] = useState<SortField>("date");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
            if (values.netEarnings > availableBalance + 0.01) {
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
        setConfirmStatusId(id);
        setConfirmStatusValue(currentStatus);
    };

    const confirmStatusChange = async () => {
        if (!confirmStatusId || !confirmStatusValue) return;
        const newStatus = confirmStatusValue === "pending" ? "received" : "pending";
        try {
            await updateStatus.mutateAsync({ id: confirmStatusId, status: newStatus });
            toast({
                title: "Status Updated",
                description: `Payment status changed to ${newStatus}.`,
            });
            setConfirmStatusId(null);
            setConfirmStatusValue(null);
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

    const handleBulkStatusUpdate = async (newStatus: string) => {
        if (selectedIds.size === 0) return;
        try {
            await Promise.all(
                Array.from(selectedIds).map(id =>
                    updateStatus.mutateAsync({ id, status: newStatus })
                )
            );
            toast({
                title: "Status Updated",
                description: `${selectedIds.size} withdrawal(s) status changed to ${newStatus}.`,
            });
            setSelectedIds(new Set());
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update status.",
                variant: "destructive",
            });
        }
    };

    // Filter & Sort Logic
    const filteredAndSortedWithdrawals = useMemo(() => {
        let result = [...withdrawals];

        // Filter by status
        if (statusFilter !== "all") {
            result = result.filter(w => w.paymentStatus === statusFilter);
        }

        // Filter by date range
        if (dateFrom) {
            const fromDate = startOfDay(new Date(dateFrom));
            result = result.filter(w => !isBefore(new Date(w.withdrawalDate), fromDate));
        }
        if (dateTo) {
            const toDate = endOfDay(new Date(dateTo));
            result = result.filter(w => !isAfter(new Date(w.withdrawalDate), toDate));
        }

        // Sort
        result.sort((a, b) => {
            let aVal: any;
            let bVal: any;

            switch (sortField) {
                case "date":
                    aVal = new Date(a.withdrawalDate).getTime();
                    bVal = new Date(b.withdrawalDate).getTime();
                    break;
                case "amount":
                    aVal = a.withdrawalAmount;
                    bVal = b.withdrawalAmount;
                    break;
                case "status":
                    aVal = a.paymentStatus;
                    bVal = b.paymentStatus;
                    break;
            }

            if (sortOrder === "asc") {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });

        return result;
    }, [withdrawals, statusFilter, dateFrom, dateTo, sortField, sortOrder]);

    // Pagination
    const paginatedWithdrawals = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAndSortedWithdrawals.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAndSortedWithdrawals, currentPage]);

    const totalPages = Math.ceil(filteredAndSortedWithdrawals.length / itemsPerPage);

    // Summary Stats
    const stats = useMemo(() => {
        const filtered = filteredAndSortedWithdrawals;
        const total = filtered.reduce((sum, w) => sum + w.withdrawalAmount, 0);
        const avg = filtered.length > 0 ? total / filtered.length : 0;
        const pending = filtered.filter(w => w.paymentStatus === "pending").reduce((sum, w) => sum + w.withdrawalAmount, 0);
        const received = filtered.filter(w => w.paymentStatus === "received").reduce((sum, w) => sum + w.withdrawalAmount, 0);
        return { total, avg, pending, received, count: filtered.length };
    }, [filteredAndSortedWithdrawals]);

    // Chart Data - Last 30 days trend
    const chartData = useMemo(() => {
        const last30Days: { [key: string]: number } = {};
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = format(date, "MMM dd");
            last30Days[dateStr] = 0;
        }

        withdrawals.forEach(w => {
            const dateStr = format(new Date(w.withdrawalDate), "MMM dd");
            if (dateStr in last30Days) {
                last30Days[dateStr] += w.withdrawalAmount;
            }
        });

        return Object.entries(last30Days).map(([date, amount]) => ({ date, amount }));
    }, [withdrawals]);

    // Export to CSV
    const exportToCSV = () => {
        const headers = ["Date", "Net Earnings", "Fee", "Amount", "Status", "Notes"];
        const rows = filteredAndSortedWithdrawals.map(w => [
            format(new Date(w.withdrawalDate), "PPP"),
            w.netEarnings.toFixed(2),
            w.transactionFee.toFixed(2),
            w.withdrawalAmount.toFixed(2),
            w.paymentStatus,
            w.notes || "",
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `withdrawals-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const isLoading = isLoadingWithdrawals || isLoadingEntries;
    const allSelected = selectedIds.size > 0 && selectedIds.size === paginatedWithdrawals.length;

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-heading">Withdrawal History</h1>
                    <p className="text-muted-foreground">Track your payment withdrawals and transaction fees</p>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
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

            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card className="shadow-sm">
                    <CardContent className="pt-6">
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground font-medium uppercase">Total Withdrawn</p>
                            <p className="text-2xl font-bold text-green-600">${stats.total.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">{stats.count} transaction{stats.count !== 1 ? 's' : ''}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardContent className="pt-6">
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground font-medium uppercase">Avg. Amount</p>
                            <p className="text-2xl font-bold text-blue-600">${stats.avg.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Per withdrawal</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardContent className="pt-6">
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground font-medium uppercase">Received</p>
                            <p className="text-2xl font-bold text-emerald-600">${stats.received.toFixed(2)}</p>
                            <Badge variant="default" className="w-fit mt-1">Received</Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardContent className="pt-6">
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground font-medium uppercase">Pending</p>
                            <p className="text-2xl font-bold text-amber-600">${stats.pending.toFixed(2)}</p>
                            <Badge variant="secondary" className="w-fit mt-1">Pending</Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardContent className="pt-6">
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground font-medium uppercase">Efficiency</p>
                            <p className="text-2xl font-bold text-purple-600">
                                {stats.received > 0 ? ((stats.received / stats.total) * 100).toFixed(0) : 0}%
                            </p>
                            <p className="text-xs text-muted-foreground">Received rate</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Withdrawal Trends Chart */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Withdrawal Trends (Last 30 Days)
                    </CardTitle>
                    <CardDescription>
                        Amount withdrawn over the past month
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {chartData.some(d => d.amount > 0) ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={chartData}>
                                <XAxis
                                    dataKey="date"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(value: number) => `$${value.toFixed(2)}`}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                                    activeDot={{ r: 8 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-80 flex items-center justify-center text-muted-foreground">
                            <p className="text-sm">No withdrawal data in the past 30 days</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Filters & Controls */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Filters & Search</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium">Status</Label>
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value as any);
                                    setCurrentPage(1);
                                }}
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
                            >
                                <option value="all">All Status</option>
                                <option value="received">Received</option>
                                <option value="pending">Pending</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-medium">Sort By</Label>
                            <select
                                value={sortField}
                                onChange={(e) => setSortField(e.target.value as SortField)}
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
                            >
                                <option value="date">Date</option>
                                <option value="amount">Amount</option>
                                <option value="status">Status</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-medium">Order</Label>
                            <select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
                            >
                                <option value="desc">Descending</option>
                                <option value="asc">Ascending</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-medium">From</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => {
                                    setDateFrom(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="text-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-medium">To</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => {
                                    setDateTo(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="text-sm"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Withdrawals List */}
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>All Withdrawals</CardTitle>
                        <CardDescription>
                            View and manage your withdrawal history ({stats.count} total)
                        </CardDescription>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {selectedIds.size > 0 && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleBulkStatusUpdate("received")}
                                >
                                    Mark {selectedIds.size} as Received
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleBulkStatusUpdate("pending")}
                                >
                                    Mark {selectedIds.size} as Pending
                                </Button>
                            </>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={exportToCSV}
                            disabled={filteredAndSortedWithdrawals.length === 0}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Export CSV
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-center py-8 text-muted-foreground">Loading withdrawals...</p>
                    ) : filteredAndSortedWithdrawals.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <p className="text-sm font-medium">No withdrawals found</p>
                            <p className="text-xs mt-1">Create your first withdrawal to start tracking</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Select All Checkbox */}
                            <div className="flex items-center gap-2 pb-3 border-b border-border">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setSelectedIds(new Set(paginatedWithdrawals.map(w => w.id)));
                                        } else {
                                            setSelectedIds(new Set());
                                        }
                                    }}
                                />
                                <span className="text-xs text-muted-foreground">Select all on this page</span>
                            </div>

                            {/* Withdrawal Rows */}
                            {paginatedWithdrawals.map((withdrawal) => (
                                <div
                                    key={withdrawal.id}
                                    className="withdrawal-row"
                                >
                                    <Checkbox
                                        checked={selectedIds.has(withdrawal.id)}
                                        onCheckedChange={(checked) => {
                                            const newSelected = new Set(selectedIds);
                                            if (checked) {
                                                newSelected.add(withdrawal.id);
                                            } else {
                                                newSelected.delete(withdrawal.id);
                                            }
                                            setSelectedIds(newSelected);
                                        }}
                                    />

                                    <div className="withdrawal-content">
                                        <div className="withdrawal-details">
                                            <p className="withdrawal-date">
                                                {format(new Date(withdrawal.withdrawalDate), "PPP")}
                                            </p>
                                            <p className="withdrawal-meta">
                                                Net: ${withdrawal.netEarnings.toFixed(2)} - Fee: ${withdrawal.transactionFee.toFixed(2)}
                                            </p>
                                            {withdrawal.notes && (
                                                <p className="withdrawal-notes">{withdrawal.notes}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="withdrawal-amount-status">
                                        <p className="withdrawal-amount">
                                            ${withdrawal.withdrawalAmount.toFixed(2)}
                                        </p>
                                        <Badge
                                            variant={withdrawal.paymentStatus === "received" ? "default" : "secondary"}
                                        >
                                            {withdrawal.paymentStatus === "received" ? "Received" : "Pending"}
                                        </Badge>
                                    </div>

                                    <div className="withdrawal-actions">
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
                            ))}

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between pt-4 border-t border-border">
                                    <p className="text-xs text-muted-foreground">
                                        Page {currentPage} of {totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Confirmation Dialog for Status Change */}
            <AlertDialog open={confirmStatusId !== null} onOpenChange={() => setConfirmStatusId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to mark this withdrawal as {confirmStatusValue === "pending" ? "received" : "pending"}?
                            This action can be reversed anytime.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex gap-2">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmStatusChange}>
                            Confirm
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
