import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Lock, User, Mail, ArrowRight, Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Weak", "Fair", "Good", "Strong"];
  const colors = ["hsl(0,70%,55%)", "hsl(38,92%,50%)", "hsl(142,60%,45%)", "hsl(142,70%,38%)"];
  return { score, label: labels[Math.min(score - 1, 3)] ?? "", color: colors[Math.min(score - 1, 3)] ?? "" };
}

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState<"username" | "email" | "password" | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const login = useAuthStore((state) => state.login);

  const strength = getPasswordStrength(password);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email: email || undefined }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast({ title: "Registration Failed", description: errorData.message || "Could not create account.", variant: "destructive" });
        return;
      }

      const data = await response.json();
      toast({ title: "Account created!", description: "Welcome to TimeTrakr." });
      login(data.user);
      navigate("/");
    } catch {
      toast({ title: "Error", description: "Failed to register. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  const inputStyle = (field: typeof focused) => ({
    fontFamily: "'Manrope', sans-serif",
    borderColor: focused === field ? "hsl(38,92%,50%)" : "hsl(220,15%,88%)",
    background: focused === field ? "hsl(38,92%,99%)" : "hsl(220,15%,98%)",
    boxShadow: focused === field ? "0 0 0 3px hsl(38,92%,50%,0.12)" : "none",
  });

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(220,20%,97%)" }}>

      {/* ── LEFT PANEL ───────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col items-center justify-center relative overflow-hidden"
        style={{ background: "hsl(228,25%,9%)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "linear-gradient(hsl(38,92%,50%) 1px, transparent 1px), linear-gradient(90deg, hsl(38,92%,50%) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, hsl(38,92%,50%,0.07) 0%, transparent 70%)" }} />

        {/* Corner accents */}
        {[["top-8 left-8 border-t border-l", ""], ["top-8 right-8 border-t border-r", ""], ["bottom-8 left-8 border-b border-l", ""], ["bottom-8 right-8 border-b border-r", ""]].map(([cls], i) => (
          <div key={i} className={`absolute w-12 h-12 opacity-20 ${cls}`} style={{ borderColor: "hsl(38,92%,50%)" }} />
        ))}

        <div className="relative z-10 flex flex-col items-center gap-12 px-16 py-12 max-w-lg w-full">
          {/* Logo */}
          <div className="self-start flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "hsl(38,92%,50%)" }}>
              <Clock className="w-4 h-4" style={{ color: "hsl(228,25%,9%)" }} />
            </div>
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif", color: "hsl(38,25%,95%)" }}>
              TimeTrakr
            </span>
          </div>

          {/* Headline */}
          <div className="self-start space-y-4">
            <h2 className="text-4xl font-bold leading-tight" style={{ fontFamily: "'Syne', sans-serif", color: "hsl(38,25%,95%)" }}>
              Start tracking<br />
              <span style={{ color: "hsl(38,92%,50%)" }}>every rupee.</span>
            </h2>
            <p className="text-sm leading-relaxed opacity-40" style={{ fontFamily: "'Manrope', sans-serif", color: "hsl(38,25%,90%)" }}>
              Join Indian freelancers who track their USD earnings, TDS deductions, and withdrawal timing — all in one place.
            </p>
          </div>

          {/* Feature pills */}
          <div className="self-start w-full space-y-3">
            {[
              { label: "Live USD/INR conversion", desc: "See your real INR value instantly" },
              { label: "TDS & GST tracking", desc: "No more tax surprises at year-end" },
              { label: "Advance tax scheduler", desc: "Never miss a quarterly deadline" },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-3 rounded-xl px-4 py-3 border"
                style={{ background: "hsl(228,25%,12%)", borderColor: "hsl(38,92%,50%,0.12)" }}>
                <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: "hsl(38,92%,50%)" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "hsl(38,25%,92%)", fontFamily: "'Manrope', sans-serif" }}>{f.label}</p>
                  <p className="text-xs opacity-40 mt-0.5" style={{ color: "hsl(38,25%,80%)", fontFamily: "'Manrope', sans-serif" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px opacity-20"
          style={{ background: "linear-gradient(90deg, transparent, hsl(38,92%,50%), transparent)" }} />

        <motion.div
          className="absolute w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(38,92%,50%,0.06) 0%, transparent 70%)", top: "5%", right: "-5%" }}
          animate={{ y: [0, -16, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(38,92%,50%,0.04) 0%, transparent 70%)", bottom: "10%", left: "-3%" }}
          animate={{ y: [0, 14, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo */}
          <motion.div
            className="flex lg:hidden items-center gap-2 justify-center mb-10"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(38,92%,50%)" }}>
              <Clock className="w-3.5 h-3.5" style={{ color: "hsl(228,25%,9%)" }} />
            </div>
            <span className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "hsl(228,25%,12%)" }}>
              TimeTrakr
            </span>
          </motion.div>

          {/* Header */}
          <motion.div className="mb-8" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-2"
              style={{ color: "hsl(38,92%,50%)", fontFamily: "'DM Mono', monospace" }}>
              Create account
            </p>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "hsl(228,25%,10%)" }}>
              Join TimeTrakr
            </h1>
            <p className="text-sm mt-1.5" style={{ color: "hsl(220,10%,48%)", fontFamily: "'Manrope', sans-serif" }}>
              Already have an account?{" "}
              <Link href="/login">
                <span className="font-semibold cursor-pointer hover:underline" style={{ color: "hsl(38,92%,45%)" }}>Sign in</span>
              </Link>
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            onSubmit={handleRegister}
            className="bg-white rounded-2xl border p-8 shadow-sm space-y-4"
            style={{ borderColor: "hsl(220,15%,90%)" }}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Social sign-up */}
            <motion.div
              className="grid grid-cols-2 gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <button
                type="button"
                onClick={() => { window.location.href = "/auth/google"; }}
                className="flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-medium transition-all duration-150 hover:bg-gray-50 hover:border-gray-300 active:scale-95"
                style={{ borderColor: "hsl(220,15%,88%)", fontFamily: "'Manrope', sans-serif", color: "hsl(228,25%,18%)" }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = "/auth/github"; }}
                className="flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-medium transition-all duration-150 hover:bg-gray-50 hover:border-gray-300 active:scale-95"
                style={{ borderColor: "hsl(220,15%,88%)", fontFamily: "'Manrope', sans-serif", color: "hsl(228,25%,18%)" }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
                GitHub
              </button>
            </motion.div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "hsl(220,15%,90%)" }} />
              <span className="text-xs font-medium" style={{ color: "hsl(220,10%,60%)", fontFamily: "'Manrope', sans-serif" }}>
                or create with email
              </span>
              <div className="flex-1 h-px" style={{ background: "hsl(220,15%,90%)" }} />
            </div>

            {/* Username */}
            <motion.div className="space-y-1.5" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(228,25%,25%)", fontFamily: "'Manrope', sans-serif" }}>
                Username
              </label>
              <motion.div className="relative" animate={focused === "username" ? { scale: 1.01 } : { scale: 1 }} transition={{ duration: 0.15 }}>
                <User className={cn("absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors", focused === "username" ? "text-amber-500" : "text-gray-400")} />
                <Input type="text" placeholder="your_username" value={username} onChange={e => setUsername(e.target.value)}
                  onFocus={() => setFocused("username")} onBlur={() => setFocused(null)}
                  disabled={isLoading} required minLength={3}
                  className="pl-10 h-11 rounded-xl border text-sm transition-all duration-200"
                  style={inputStyle("username")} />
              </motion.div>
            </motion.div>

            {/* Email */}
            <motion.div className="space-y-1.5" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "hsl(228,25%,25%)", fontFamily: "'Manrope', sans-serif" }}>
                Email
                <span className="normal-case font-normal text-[10px] px-1.5 py-0.5 rounded" style={{ color: "hsl(220,10%,55%)", background: "hsl(220,15%,93%)" }}>for tax reminders</span>
              </label>
              <motion.div className="relative" animate={focused === "email" ? { scale: 1.01 } : { scale: 1 }} transition={{ duration: 0.15 }}>
                <Mail className={cn("absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors", focused === "email" ? "text-amber-500" : "text-gray-400")} />
                <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                  disabled={isLoading}
                  className="pl-10 h-11 rounded-xl border text-sm transition-all duration-200"
                  style={inputStyle("email")} />
              </motion.div>
            </motion.div>

            {/* Password + strength */}
            <motion.div className="space-y-1.5" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(228,25%,25%)", fontFamily: "'Manrope', sans-serif" }}>
                Password
              </label>
              <motion.div className="relative" animate={focused === "password" ? { scale: 1.01 } : { scale: 1 }} transition={{ duration: 0.15 }}>
                <Lock className={cn("absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors", focused === "password" ? "text-amber-500" : "text-gray-400")} />
                <Input type="password" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")} onBlur={() => setFocused(null)}
                  disabled={isLoading} required minLength={6}
                  className="pl-10 h-11 rounded-xl border text-sm transition-all duration-200"
                  style={inputStyle("password")} />
              </motion.div>
              {/* Strength meter */}
              {password && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.2 }}>
                  <div className="flex gap-1 mt-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                        style={{ background: i <= strength.score ? strength.color : "hsl(220,15%,88%)" }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {strength.score >= 3 && <Check className="w-3 h-3" style={{ color: strength.color }} />}
                    <p className="text-xs" style={{ color: strength.color, fontFamily: "'Manrope', sans-serif" }}>
                      {strength.label}
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Submit */}
            <motion.div className="pt-1" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
              <motion.button
                type="submit"
                disabled={isLoading || !username || !password}
                className={cn(
                  "w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                )}
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  background: "hsl(38,92%,50%)",
                  color: "hsl(228,25%,9%)",
                  boxShadow: username && password && !isLoading ? "0 4px 20px hsl(38,92%,50%,0.4)" : "none",
                }}
                whileHover={!isLoading ? { scale: 1.02, boxShadow: "0 6px 28px hsl(38,92%,50%,0.5)" } : {}}
                whileTap={!isLoading ? { scale: 0.97 } : {}}
              >
                {isLoading ? (
                  <>
                    <motion.svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
                      animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </motion.svg>
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </motion.div>
          </motion.form>

          <motion.p
            className="text-center text-[11px] mt-6 opacity-40"
            style={{ color: "hsl(220,10%,40%)", fontFamily: "'Manrope', sans-serif" }}
            initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} transition={{ delay: 0.6 }}
          >
            © 2025 TimeTrakr. All rights reserved.
          </motion.p>
        </div>
      </div>
    </div>
  );
}
