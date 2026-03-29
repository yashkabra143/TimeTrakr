import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Sparkles } from "lucide-react";
import { useCreateSubscription, useVerifySubscription } from "@/lib/hooks";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Razorpay Checkout type declaration
declare global {
  interface Window {
    Razorpay: any;
  }
}

async function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
}

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

export function UpgradeModal({ open, onOpenChange, featureName }: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("monthly");
  const [isLoading, setIsLoading] = useState(false);
  const createSub = useCreateSubscription();
  const verifySub = useVerifySubscription();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast({ title: "Error", description: "Failed to load payment gateway. Please try again.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Send planType to server; server resolves the Razorpay plan ID from env vars
      const { subscriptionId } = await createSub.mutateAsync(selectedPlan);

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        subscription_id: subscriptionId,
        name: "TimeTrakr",
        description: selectedPlan === "monthly" ? "Pro Monthly — ₹349/mo" : "Pro Annual — ₹2,999/yr",
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await verifySub.mutateAsync(response);
            onOpenChange(false);
            toast({ title: "Pro activated!", description: "Welcome to TimeTrakr Pro. Enjoy all premium features." });
            navigate("/billing?success=1");
          } catch (err) {
            toast({ title: "Verification failed", description: "Payment received but verification failed. Please contact support.", variant: "destructive" });
          }
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false);
          },
        },
        theme: { color: "hsl(38,92%,50%)" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast({ title: "Error", description: "Failed to start checkout. Please try again.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl" style={{ fontFamily: "'Syne', sans-serif" }}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Upgrade to Pro
            </div>
          </DialogTitle>
          {featureName && (
            <DialogDescription style={{ fontFamily: "'Manrope', sans-serif" }}>
              {featureName} is a Pro feature. Upgrade to unlock it and all other premium features.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
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
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-500 text-amber-950 text-[10px] font-bold uppercase tracking-wider rounded-full">
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
        <div className="flex items-center justify-center gap-2 mt-4">
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
          onClick={handleUpgrade}
          disabled={isLoading || createSub.isPending}
          className="w-full mt-4 py-3 rounded-xl bg-amber-500 text-amber-950 font-bold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          {isLoading || createSub.isPending ? "Loading..." : `Subscribe — ${selectedPlan === "monthly" ? "₹349/mo" : "₹2,999/yr"}`}
        </button>

        <p className="text-[11px] text-center text-muted-foreground mt-2">
          Cancel anytime. Access continues until end of billing period.
        </p>
      </DialogContent>
    </Dialog>
  );
}
