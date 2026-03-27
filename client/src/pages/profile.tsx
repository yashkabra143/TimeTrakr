import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Upload, Calendar, Lock, X, Camera } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const profileSchema = z.object({
  fullName:       z.string().optional(),
  email:          z.string().email("Invalid email").optional().or(z.literal("")),
  dateOfBirth:    z.string().optional().or(z.literal("")),
  profilePicture: z.string().optional().or(z.literal("")),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword:     z.string().min(6, "At least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm"),
}).refine(d => d.newPassword === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof changePasswordSchema>;

const fade = (i = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] } },
});

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        style={{ fontFamily: "'Manrope', sans-serif" }}>{label}</label>
      {children}
    </div>
  );
}

export default function Profile() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  const user = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.login);

  const [previewImage, setPreviewImage] = useState("");

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", email: "", dateOfBirth: "", profilePicture: "" },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user) { toast({ variant: "destructive", title: "Error", description: "Not logged in." }); return; }
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentUsername: user.username, username: data.fullName ? undefined : user.username, ...data }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      localStorage.setItem("user", JSON.stringify(updated.user));
      updateUser(updated.user);
      toast({ title: "Profile updated" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to update profile." });
    }
  };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    if (!user) { toast({ variant: "destructive", title: "Error", description: "Not logged in." }); return; }
    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, currentPassword: data.currentPassword, newPassword: data.newPassword }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      toast({ title: "Password updated" });
      passwordForm.reset();
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: err instanceof Error ? err.message : "Something went wrong." });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ variant: "destructive", title: "Invalid file type" }); return; }
    if (file.size > MAX_FILE_SIZE) { toast({ variant: "destructive", title: "File too large", description: "Max 5 MB." }); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const b64 = ev.target?.result as string;
      setPreviewImage(b64);
      form.setValue("profilePicture", b64);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setPreviewImage("");
    form.setValue("profilePicture", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!user?.username || initializedRef.current) return;
    initializedRef.current = true;
    fetch(`/api/users/${user.username}`).then(r => r.json()).then(d => {
      updateUser(d.user);
      form.reset({ fullName: d.user.fullName || "", email: d.user.email || "", dateOfBirth: d.user.dateOfBirth || "", profilePicture: d.user.profilePicture || "" });
      setPreviewImage(d.user.profilePicture || "");
    }).catch(() => {});
  }, [user?.username]);

  const displayName = user?.fullName || user?.username || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-7 pb-12">

      {/* Header */}
      <motion.div {...fade(0)} className="flex items-center gap-4">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-primary/20">
            {previewImage ? (
              <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold"
                style={{ background: "hsl(38,92%,50%)", color: "hsl(228,25%,9%)", fontFamily: "'Syne', sans-serif" }}>
                {initial}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-background transition-colors hover:bg-primary"
            style={{ background: "hsl(38,92%,50%)" }}
          >
            <Camera className="w-3 h-3" style={{ color: "hsl(228,25%,9%)" }} />
          </button>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>Account</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>{displayName}</h1>
          <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>{user?.email || "No email set"}</p>
        </div>
      </motion.div>

      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        {/* Left column */}
        <div className="space-y-5">

          {/* Personal Info */}
          <motion.div {...fade(1)} className="bg-card border border-border/60 rounded-2xl overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-border/40">
              <h2 className="text-sm font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>Personal Information</h2>
              <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>Update your personal details.</p>
            </div>
            <div className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onProfileSubmit)} className="space-y-5">
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem>
                      <FieldRow label="Full Name">
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="John Doe" className="pl-9 h-10 rounded-xl" {...field} />
                          </div>
                        </FormControl>
                      </FieldRow>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FieldRow label="Email">
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input placeholder="john@example.com" className="pl-9 h-10 rounded-xl" {...field} />
                            </div>
                          </FormControl>
                        </FieldRow>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                      <FormItem>
                        <FieldRow label="Date of Birth">
                          <FormControl>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                              <Input type="date" className="pl-9 h-10 rounded-xl [&::-webkit-calendar-picker-indicator]:opacity-0" {...field} />
                            </div>
                          </FormControl>
                        </FieldRow>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Profile picture upload */}
                  <FormField control={form.control} name="profilePicture" render={() => (
                    <FormItem>
                      <FieldRow label="Profile Picture">
                        <FormControl>
                          <div className="space-y-3">
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                              className="flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-semibold border border-border hover:bg-muted transition-colors w-full justify-center"
                              style={{ fontFamily: "'Manrope', sans-serif" }}>
                              <Upload className="w-3.5 h-3.5" /> Choose Image
                            </button>
                            {previewImage && (
                              <div className="relative w-20 h-20 mx-auto">
                                <img src={previewImage} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                                <button type="button" onClick={removeImage}
                                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-destructive text-white">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </FormControl>
                      </FieldRow>
                      <FormDescription className="text-xs">Max size: 5 MB</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="flex justify-end pt-2">
                    <motion.button type="submit" disabled={form.formState.isSubmitting}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="px-5 h-10 rounded-xl text-xs font-semibold"
                      style={{ fontFamily: "'Manrope', sans-serif", background: "hsl(38,92%,50%)", color: "hsl(228,25%,9%)" }}>
                      {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
                    </motion.button>
                  </div>
                </form>
              </Form>
            </div>
          </motion.div>

          {/* Change Password */}
          <motion.div {...fade(2)} className="bg-card border border-border/60 rounded-2xl overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-border/40">
              <h2 className="text-sm font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>Change Password</h2>
              <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>Keep your account secure.</p>
            </div>
            <div className="p-6">
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                  <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                    <FormItem>
                      <FieldRow label="Current Password">
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input type="password" placeholder="••••••" className="pl-9 h-10 rounded-xl" {...field} />
                          </div>
                        </FormControl>
                      </FieldRow>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                      <FormItem>
                        <FieldRow label="New Password">
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input type="password" placeholder="••••••" className="pl-9 h-10 rounded-xl" {...field} />
                            </div>
                          </FormControl>
                        </FieldRow>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FieldRow label="Confirm Password">
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input type="password" placeholder="••••••" className="pl-9 h-10 rounded-xl" {...field} />
                            </div>
                          </FormControl>
                        </FieldRow>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end pt-2">
                    <motion.button type="submit" disabled={passwordForm.formState.isSubmitting}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="px-5 h-10 rounded-xl text-xs font-semibold"
                      style={{ fontFamily: "'Manrope', sans-serif", background: "hsl(228,25%,12%)", color: "white" }}>
                      {passwordForm.formState.isSubmitting ? "Updating..." : "Update Password"}
                    </motion.button>
                  </div>
                </form>
              </Form>
            </div>
          </motion.div>
        </div>

        {/* Right column — avatar card */}
        <motion.div {...fade(3)} className="space-y-5">
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-border/40">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>Your Profile</h2>
            </div>
            <div className="p-5 flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden ring-4 ring-primary/15 ring-offset-2 ring-offset-card">
                {previewImage ? (
                  <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold"
                    style={{ background: "hsl(38,92%,50%)", color: "hsl(228,25%,9%)", fontFamily: "'Syne', sans-serif" }}>
                    {initial}
                  </div>
                )}
              </div>
              <div className="text-center space-y-0.5">
                <p className="font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>{displayName}</p>
                <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  @{user?.username}
                </p>
                {user?.email && (
                  <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {user.email}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontFamily: "'Manrope', sans-serif" }}>
                <Camera className="w-3.5 h-3.5" /> Change photo
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
