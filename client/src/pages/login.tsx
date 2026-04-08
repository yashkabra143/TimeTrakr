import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Lock, User, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const raw = time.getHours();
  const ampm = raw >= 12 ? "PM" : "AM";
  const hh = String(raw % 12 || 12).padStart(2, "0");
  const mm = String(time.getMinutes()).padStart(2, "0");

  // Clock hand angles
  const secAngle = time.getSeconds() * 6;
  const minAngle = time.getMinutes() * 6 + time.getSeconds() * 0.1;
  const hrAngle = (time.getHours() % 12) * 30 + time.getMinutes() * 0.5;

  const ticks = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* Analog Clock */}
      <div className="relative w-56 h-56 sm:w-64 sm:h-64">
        {/* Outer ring */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
          {/* Ambient glow */}
          <defs>
            <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(38,92%,50%)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="hsl(38,92%,50%)" stopOpacity="0" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx="100" cy="100" r="95" fill="url(#glowGrad)" />
          <circle cx="100" cy="100" r="88" fill="none" stroke="hsl(38,92%,50%)" strokeWidth="0.5" opacity="0.3" />
          <circle cx="100" cy="100" r="78" fill="none" stroke="hsl(38,92%,50%)" strokeWidth="0.25" opacity="0.15" />

          {/* Tick marks */}
          {ticks.map((i) => {
            const angle = (i * 6 - 90) * (Math.PI / 180);
            const isHour = i % 5 === 0;
            const r1 = isHour ? 72 : 76;
            const r2 = 80;
            const x1 = 100 + r1 * Math.cos(angle);
            const y1 = 100 + r1 * Math.sin(angle);
            const x2 = 100 + r2 * Math.cos(angle);
            const y2 = 100 + r2 * Math.sin(angle);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="hsl(38,92%,50%)"
                strokeWidth={isHour ? 1.5 : 0.5}
                opacity={isHour ? 0.9 : 0.3}
              />
            );
          })}

          {/* Hour hand */}
          <line
            x1="100" y1="100"
            x2={100 + 42 * Math.cos((hrAngle - 90) * Math.PI / 180)}
            y2={100 + 42 * Math.sin((hrAngle - 90) * Math.PI / 180)}
            stroke="hsl(38,92%,80%)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#glow)"
          />

          {/* Minute hand */}
          <line
            x1="100" y1="100"
            x2={100 + 58 * Math.cos((minAngle - 90) * Math.PI / 180)}
            y2={100 + 58 * Math.sin((minAngle - 90) * Math.PI / 180)}
            stroke="hsl(38,92%,65%)"
            strokeWidth="1.5"
            strokeLinecap="round"
            filter="url(#glow)"
          />

          {/* Second hand */}
          <line
            x1={100 - 14 * Math.cos((secAngle - 90) * Math.PI / 180)}
            y1={100 - 14 * Math.sin((secAngle - 90) * Math.PI / 180)}
            x2={100 + 68 * Math.cos((secAngle - 90) * Math.PI / 180)}
            y2={100 + 68 * Math.sin((secAngle - 90) * Math.PI / 180)}
            stroke="hsl(38,92%,50%)"
            strokeWidth="0.75"
            strokeLinecap="round"
            filter="url(#glow)"
          />

          {/* Center dot */}
          <circle cx="100" cy="100" r="3" fill="hsl(38,92%,50%)" filter="url(#glow)" />
          <circle cx="100" cy="100" r="1.5" fill="hsl(38,92%,80%)" />
        </svg>
      </div>

      {/* Digital time display */}
      <div className="text-center">
        <p
          className="tabular-nums leading-none"
          style={{ fontFamily: "'DM Mono', monospace", color: "hsl(38,92%,60%)" }}
        >
          <span className="text-5xl tracking-[0.12em]">{hh}:{mm}</span>
          <span
            className="text-base font-semibold ml-2 align-middle"
            style={{ color: "hsl(38,92%,50%)", letterSpacing: "0.1em" }}
          >
            {ampm}
          </span>
        </p>
        <p className="mt-2 text-xs tracking-[0.3em] uppercase opacity-40" style={{ fontFamily: "'DM Mono', monospace", color: "hsl(38,50%,80%)" }}>
          {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState<"username" | "password" | null>(null);
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const login = useAuthStore((state) => state.login);

  // Show toast for OAuth errors
  useEffect(() => {
    const params = new URLSearchParams(search);
    const error = params.get("error");
    if (error === "oauth_failed") {
      toast({ title: "Sign-in failed", description: "OAuth sign-in failed. Please try again.", variant: "destructive" });
    } else if (error === "oauth_cancelled") {
      toast({ title: "Cancelled", description: "Sign-in was cancelled." });
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast({
          title: "Login Failed",
          description: errorData.message || "Invalid username or password",
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();
      toast({ title: "Welcome back", description: "Signed in successfully." });
      login(data.user);
      navigate("/dashboard");
    } catch {
      toast({
        title: "Error",
        description: "Failed to login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(220,20%,97%)" }}>
      {/* ── LEFT PANEL ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col items-center justify-center relative overflow-hidden"
        style={{ background: "hsl(228,25%,9%)" }}
      >
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(38,92%,50%) 1px, transparent 1px), linear-gradient(90deg, hsl(38,92%,50%) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Radial amber glow behind clock */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 50%, hsl(38,92%,50%,0.07) 0%, transparent 70%)",
          }}
        />

        {/* Corner accent lines */}
        <div className="absolute top-8 left-8 w-12 h-12 border-t border-l opacity-20" style={{ borderColor: "hsl(38,92%,50%)" }} />
        <div className="absolute top-8 right-8 w-12 h-12 border-t border-r opacity-20" style={{ borderColor: "hsl(38,92%,50%)" }} />
        <div className="absolute bottom-8 left-8 w-12 h-12 border-b border-l opacity-20" style={{ borderColor: "hsl(38,92%,50%)" }} />
        <div className="absolute bottom-8 right-8 w-12 h-12 border-b border-r opacity-20" style={{ borderColor: "hsl(38,92%,50%)" }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-12 px-16 py-12 max-w-lg w-full">
          {/* Logo + wordmark */}
          <div className="self-start flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "hsl(38,92%,50%)" }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                <circle cx="12" cy="12" r="9" stroke="hsl(228,25%,9%)" strokeWidth="2" />
                <path d="M12 7v5l3 3" stroke="hsl(228,25%,9%)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: "'Syne', sans-serif", color: "hsl(38,25%,95%)" }}
            >
              TimeTrakr
            </span>
          </div>

          {/* Live clock */}
          <LiveClock />

          {/* Tagline */}
          <div className="self-start space-y-3">
            <h2
              className="text-3xl font-bold leading-tight"
              style={{ fontFamily: "'Syne', sans-serif", color: "hsl(38,25%,95%)" }}
            >
              Every hour,<br />
              <span style={{ color: "hsl(38,92%,50%)" }}>accounted for.</span>
            </h2>
            <p className="text-sm leading-relaxed opacity-40" style={{ fontFamily: "'Manrope', sans-serif", color: "hsl(38,25%,90%)" }}>
              Track time, manage projects, and understand your earnings — all in one precise instrument.
            </p>
          </div>

          {/* Stats row */}
          <div className="self-start w-full grid grid-cols-3 gap-4">
            {[
              { label: "Projects", value: "∞" },
              { label: "Accuracy", value: "1s" },
              { label: "Reports", value: "Live" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-3 border"
                style={{
                  background: "hsl(228,25%,12%)",
                  borderColor: "hsl(38,92%,50%,0.12)",
                }}
              >
                <p
                  className="text-xl font-bold"
                  style={{ fontFamily: "'DM Mono', monospace", color: "hsl(38,92%,55%)" }}
                >
                  {s.value}
                </p>
                <p className="text-[11px] uppercase tracking-widest mt-0.5 opacity-40" style={{ color: "hsl(38,25%,85%)", fontFamily: "'Manrope', sans-serif" }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
        {/* Faint top accent */}
        <div
          className="absolute top-0 left-0 right-0 h-px opacity-20"
          style={{ background: "linear-gradient(90deg, transparent, hsl(38,92%,50%), transparent)" }}
        />

        {/* Floating background orbs */}
        <motion.div
          className="absolute w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, hsl(38,92%,50%,0.07) 0%, transparent 70%)",
            top: "10%", right: "-5%",
          }}
          animate={{ y: [0, -20, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-48 h-48 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, hsl(38,92%,50%,0.05) 0%, transparent 70%)",
            bottom: "15%", left: "-3%",
          }}
          animate={{ y: [0, 16, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
        <motion.div
          className="absolute w-32 h-32 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, hsl(228,25%,50%,0.04) 0%, transparent 70%)",
            top: "55%", right: "8%",
          }}
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />

        <div className="w-full max-w-sm relative z-10">
          {/* Mobile-only logo */}
          <motion.div
            className="flex lg:hidden items-center gap-2 justify-center mb-10"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "hsl(38,92%,50%)" }}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
                <circle cx="12" cy="12" r="9" stroke="hsl(228,25%,9%)" strokeWidth="2" />
                <path d="M12 7v5l3 3" stroke="hsl(228,25%,9%)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span
              className="text-lg font-bold"
              style={{ fontFamily: "'Syne', sans-serif", color: "hsl(228,25%,12%)" }}
            >
              TimeTrakr
            </span>
          </motion.div>

          {/* Header */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            <motion.p
              className="text-xs font-semibold uppercase tracking-[0.25em] mb-2"
              style={{ color: "hsl(38,92%,50%)", fontFamily: "'DM Mono', monospace" }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              Sign in
            </motion.p>
            <h1
              className="text-3xl font-bold"
              style={{ fontFamily: "'Syne', sans-serif", color: "hsl(228,25%,10%)" }}
            >
              Welcome back
            </h1>
            <p className="text-sm mt-1.5" style={{ color: "hsl(220,10%,48%)", fontFamily: "'Manrope', sans-serif" }}>
              Enter your credentials to continue
            </p>
          </motion.div>

          {/* Form card */}
          <motion.form
            onSubmit={handleLogin}
            className="bg-white rounded-2xl border p-8 shadow-sm space-y-5"
            style={{ borderColor: "hsl(220,15%,90%)" }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Social sign-in */}
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
                or
              </span>
              <div className="flex-1 h-px" style={{ background: "hsl(220,15%,90%)" }} />
            </div>

            {/* Username */}
            <motion.div
              className="space-y-1.5"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.28 }}
            >
              <label
                htmlFor="login-username"
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "hsl(228,25%,25%)", fontFamily: "'Manrope', sans-serif" }}
              >
                Username
              </label>
              <motion.div
                className="relative"
                animate={focused === "username" ? { scale: 1.01 } : { scale: 1 }}
                transition={{ duration: 0.15 }}
              >
                <User
                  className={cn(
                    "absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200",
                    focused === "username" ? "text-amber-500" : "text-gray-400"
                  )}
                />
                <Input
                  id="login-username"
                  type="text"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocused("username")}
                  onBlur={() => setFocused(null)}
                  disabled={isLoading}
                  required
                  data-testid="input-username"
                  className="pl-10 h-11 rounded-xl border text-sm transition-all duration-200 focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:border-amber-400"
                  style={{
                    fontFamily: "'Manrope', sans-serif",
                    borderColor: focused === "username" ? "hsl(38,92%,50%)" : "hsl(220,15%,88%)",
                    background: focused === "username" ? "hsl(38,92%,99%)" : "hsl(220,15%,98%)",
                    boxShadow: focused === "username" ? "0 0 0 3px hsl(38,92%,50%,0.12)" : "none",
                  }}
                />
              </motion.div>
            </motion.div>

            {/* Password */}
            <motion.div
              className="space-y-1.5"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.36 }}
            >
              <label
                htmlFor="login-password"
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "hsl(228,25%,25%)", fontFamily: "'Manrope', sans-serif" }}
              >
                Password
              </label>
              <motion.div
                className="relative"
                animate={focused === "password" ? { scale: 1.01 } : { scale: 1 }}
                transition={{ duration: 0.15 }}
              >
                <Lock
                  className={cn(
                    "absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200",
                    focused === "password" ? "text-amber-500" : "text-gray-400"
                  )}
                />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  disabled={isLoading}
                  required
                  data-testid="input-password"
                  className="pl-10 h-11 rounded-xl border text-sm transition-all duration-200 focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:border-amber-400"
                  style={{
                    fontFamily: "'Manrope', sans-serif",
                    borderColor: focused === "password" ? "hsl(38,92%,50%)" : "hsl(220,15%,88%)",
                    background: focused === "password" ? "hsl(38,92%,99%)" : "hsl(220,15%,98%)",
                    boxShadow: focused === "password" ? "0 0 0 3px hsl(38,92%,50%,0.12)" : "none",
                  }}
                />
              </motion.div>
            </motion.div>

            {/* Forgot password */}
            <div className="flex justify-end -mt-1">
              <span
                className="text-xs cursor-pointer hover:underline"
                style={{ color: "hsl(38,92%,45%)", fontFamily: "'Manrope', sans-serif" }}
                onClick={() => toast({ title: "Password reset", description: "Use Google or GitHub sign-in, or contact support to reset your password." })}
              >
                Forgot password?
              </span>
            </div>

            {/* Submit */}
            <motion.div
              className="pt-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.44 }}
            >
              <motion.button
                type="submit"
                disabled={isLoading || !username || !password}
                data-testid="button-login"
                className={cn(
                  "w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                )}
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  background: "hsl(38,92%,50%)",
                  color: "hsl(228,25%,9%)",
                  boxShadow: username && password && !isLoading
                    ? "0 4px 20px hsl(38,92%,50%,0.4)"
                    : "none",
                }}
                whileHover={!isLoading && username && password ? { scale: 1.02, boxShadow: "0 6px 28px hsl(38,92%,50%,0.5)" } : {}}
                whileTap={!isLoading && username && password ? { scale: 0.97 } : {}}
                transition={{ duration: 0.15 }}
              >
                {/* Shimmer sweep on hover */}
                {username && password && !isLoading && (
                  <motion.span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(105deg, transparent 40%, hsl(0,0%,100%,0.18) 50%, transparent 60%)",
                      backgroundSize: "200% 100%",
                    }}
                    animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                  />
                )}
                {isLoading ? (
                  <>
                    <motion.svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </motion.svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <motion.span
                      animate={username && password ? { x: [0, 3, 0] } : { x: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </motion.span>
                  </>
                )}
              </motion.button>
            </motion.div>
          </motion.form>

          {/* Register link */}
          <motion.p
            className="text-center text-sm mt-5"
            style={{ color: "hsl(220,10%,50%)", fontFamily: "'Manrope', sans-serif" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.55 }}
          >
            Don't have an account?{" "}
            <a
              href="/register"
              className="font-semibold transition-colors duration-150 hover:opacity-80"
              style={{ color: "hsl(38,92%,45%)" }}
            >
              Create one
            </a>
          </motion.p>

          {/* Footer */}
          <motion.p
            className="text-center text-[11px] mt-4 opacity-40"
            style={{ color: "hsl(220,10%,40%)", fontFamily: "'Manrope', sans-serif" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            © 2025 TimeTrakr. All rights reserved.
          </motion.p>
        </div>
      </div>
    </div>
  );
}
