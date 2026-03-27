import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Lock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      style={{ fontFamily: "'Manrope', sans-serif" }}>
      {children}
    </span>
  );
}

export function ChangePasswordDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordFormValues) => {
    try {
      const userStr = localStorage.getItem("user");
      const username = userStr ? JSON.parse(userStr).username : "admin";

      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update password");
      }

      toast({ title: "Password Updated", description: "Your password has been changed successfully." });
      setOpen(false);
      form.reset();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-semibold border border-border/60 bg-card hover:bg-muted/50 transition-colors"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <Lock className="w-3.5 h-3.5" />
            Change Password
          </motion.button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm rounded-2xl p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-border/60">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "hsl(38,92%,50%)" }}>
                <Lock className="w-4 h-4" style={{ color: "hsl(228,25%,9%)" }} />
              </div>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                Change Password
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Enter your current password and a new secure password.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Form */}
        <div className="px-6 py-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Current Password</FieldLabel>
                    <FormControl>
                      <Input type="password" className="h-10 rounded-xl mt-1.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>New Password</FieldLabel>
                    <FormControl>
                      <Input type="password" className="h-10 rounded-xl mt-1.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Confirm New Password</FieldLabel>
                    <FormControl>
                      <Input type="password" className="h-10 rounded-xl mt-1.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-1">
                <motion.button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  whileHover={!form.formState.isSubmitting ? { scale: 1.01, boxShadow: "0 6px 24px hsl(38,92%,50%,0.35)" } : {}}
                  whileTap={!form.formState.isSubmitting ? { scale: 0.98 } : {}}
                  className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    fontFamily: "'Manrope', sans-serif",
                    background: "hsl(38,92%,50%)",
                    color: "hsl(228,25%,9%)",
                    boxShadow: "0 4px 16px hsl(38,92%,50%,0.25)",
                  }}
                >
                  {form.formState.isSubmitting ? "Updating..." : "Update Password"}
                  {!form.formState.isSubmitting && <ArrowRight className="w-4 h-4" />}
                </motion.button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
