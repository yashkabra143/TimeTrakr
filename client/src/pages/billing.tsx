import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useCurrentUser, useSubscriptionStatus, useCancelSubscription, useIsPro } from "@/lib/hooks";
import { UpgradeModal } from "@/components/upgrade-modal";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Check, Sparkles, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FREE_FEATURES = [
  "Unlimited time entries",
  "Unlimited projects",
  "Dashboard & analytics",
  "Withdrawal tracking",
  "Advance Tax scheduler",
];

const PRO_FEATURES = [
  "Everything in Free",
  "GST liability tracker",
  "TDS reconciliation",
  "Tax email reminders",
  "CSV import (Upwork)",
  "CA-ready PDF export",
];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function maskSubId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}${"•".repeat(id.length - 8)}${id.slice(-4)}`;
}

export default function BillingPage() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("monthly");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: user } = useCurrentUser();
  const { data: subStatus } = useSubscriptionStatus();
  const cancelSub = useCancelSubscription();
  const isPro = useIsPro();

  // Handle ?success=1 redirect from Razorpay (D-11)
  useEffect(() => {
    const isSuccess = new URLSearchParams(window.location.search).get("success") === "1";
    if (isSuccess) {
      toast({ title: "Pro activated!", description: "Welcome to TimeTrakr Pro." });
      window.history.replaceState({}, "", "/billing");
    }
  }, [toast]);

  const planType = subStatus?.planType ?? user?.planType ?? "free";
  const planExpiresAt = subStatus?.planExpiresAt ?? null;
  const razorpaySubId = subStatus?.razorpaySubId ?? null;

  const isMonthly = planType === "pro_monthly";
  const isAnnual = planType === "pro_annual";

  function planLabel() {
    if (isMonthly) return "Pro Monthly — ₹349/mo";
    if (isAnnual) return "Pro Annual — ₹2,999/yr";
    return "Free Plan";
  }

  async function handleCancel() {
    try {
      await cancelSub.mutateAsync();
      setCancelDialogOpen(false);
      toast({
        title: "Subscription cancelled",
        description: planExpiresAt
          ? `Pro access continues until ${formatDate(planExpiresAt)}.`
          : "Your Pro access will not renew.",
      });
    } catch (err: any) {
      toast({ title: "Cancellation failed", description: err?.message ?? "Please try again.", variant: "destructive" });
    }
  }

  return (
    <>
      <div className="space-y-8">
        {/* Page header */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-1"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            Subscription
          </p>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
            Billing &amp; Subscription
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Manage your plan and payment details
          </p>
        </div>

        {/* Current plan card */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
              <CreditCard className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                Current Plan
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Your active subscription
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-xl font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>
                {planLabel()}
              </p>
              {isPro && planExpiresAt && (
                <p className="text-sm text-muted-foreground mt-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Renews on {formatDate(planExpiresAt)}
                </p>
              )}
              {!isPro && (
                <p className="text-sm text-muted-foreground mt-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  You're on the free tier. Upgrade to Pro to unlock all features.
                </p>
              )}
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isPro
                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              {isPro ? "Pro" : "Free"}
            </span>
          </div>
        </div>

        {/* Plan comparison (Free users only) */}
        {!isPro && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                  Upgrade to Pro
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Unlock all premium features
                </p>
              </div>
            </div>

            {/* Plan comparison columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Free column */}
              <div className="p-4 rounded-xl border border-border bg-muted/20">
                <p className="text-sm font-bold mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>Free</p>
                <p className="text-xs text-muted-foreground mb-3" style={{ fontFamily: "'DM Mono', monospace" }}>₹0 forever</p>
                <ul className="space-y-2">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      <Check className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pro column */}
              <div className="p-4 rounded-xl border-2 border-amber-400 bg-amber-50/50 relative">
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-500 text-amber-950 text-[10px] font-bold uppercase tracking-wider rounded-full whitespace-nowrap">
                  Recommended
                </div>
                <p className="text-sm font-bold mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>Pro</p>
                <p className="text-xs text-muted-foreground mb-3" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {selectedPlan === "monthly" ? "₹349/mo" : "₹2,999/yr"}
                </p>
                <ul className="space-y-2">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Plan toggle */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setSelectedPlan("monthly")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedPlan === "monthly"
                    ? "bg-amber-500 text-amber-950"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Monthly ₹349
              </button>
              <button
                onClick={() => setSelectedPlan("annual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedPlan === "annual"
                    ? "bg-amber-500 text-amber-950"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Annual ₹2,999
                <span className="ml-1 text-[10px] opacity-70">(save 29%)</span>
              </button>
            </div>

            {/* CTA */}
            <button
              onClick={() => setUpgradeOpen(true)}
              className="flex items-center gap-2 h-10 px-6 rounded-xl bg-amber-500 text-amber-950 text-sm font-semibold hover:bg-amber-400 transition-colors"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              <Sparkles className="w-4 h-4" />
              Subscribe — {selectedPlan === "monthly" ? "₹349/mo" : "₹2,999/yr"}
            </button>

            <p className="text-[11px] text-muted-foreground mt-3">
              Cancel anytime. Access continues until end of billing period.
            </p>
          </div>
        )}

        {/* Subscription management (Pro users only) */}
        {isPro && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                <CreditCard className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                  Subscription Details
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Manage your active Pro subscription
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>Plan</p>
                <p className="text-sm font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{planLabel()}</p>
              </div>
              {planExpiresAt && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>Next Billing Date</p>
                  <p className="text-sm font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{formatDate(planExpiresAt)}</p>
                </div>
              )}
              {razorpaySubId && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>Subscription ID</p>
                  <p className="text-sm font-mono text-muted-foreground">{maskSubId(razorpaySubId)}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setCancelDialogOpen(true)}
              disabled={cancelSub.isPending}
              className="flex items-center gap-2 h-10 px-5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              <AlertTriangle className="w-4 h-4" />
              Cancel Subscription
            </button>

            <p className="text-[11px] text-muted-foreground mt-3">
              Cancelling will stop renewal. Your Pro access continues until {formatDate(planExpiresAt)}.
            </p>
          </div>
        )}
      </div>

      {/* Upgrade Modal (Free users) */}
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "'Syne', sans-serif" }}>
              Cancel Subscription?
            </AlertDialogTitle>
            <AlertDialogDescription style={{ fontFamily: "'Manrope', sans-serif" }}>
              Are you sure? Your Pro access will continue until{" "}
              <strong>{formatDate(planExpiresAt)}</strong> but will not renew.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ fontFamily: "'Manrope', sans-serif" }}>
              Keep Subscription
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700 text-white"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              {cancelSub.isPending ? "Cancelling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
