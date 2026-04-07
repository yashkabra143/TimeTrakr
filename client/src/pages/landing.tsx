import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Timer, TrendingUp, Receipt, FileText, Bell, Download,
  Check, Sparkles, Menu, X, Clock, ArrowRight, ChevronRight,
  IndianRupee, Globe, ShieldCheck,
} from "lucide-react";
import Galaxy from "@/components/galaxy";

// ── Animation variants ─────────────────────────────────────────────────────
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.11, delayChildren: 0.15 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

// ── Data ───────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Timer,
    title: "Precise Time Tracking",
    desc: "Log hours in H.MM format across projects. Set USD hourly rates and watch your earnings calculate instantly.",
    accent: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    icon: TrendingUp,
    title: "Live Earnings Dashboard",
    desc: "Real-time USD → INR conversion with daily, weekly, and monthly breakdowns. Know exactly where you stand.",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    icon: Receipt,
    title: "GST Liability Tracker",
    desc: "Automatically calculate 18% GST on eligible income. Stay compliant without hiring a consultant.",
    accent: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: FileText,
    title: "TDS Reconciliation",
    desc: "Log Section 194J deductions and reconcile against Advance Tax liability. Built for Indian tax law.",
    accent: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
  },
  {
    icon: Bell,
    title: "Advance Tax Reminders",
    desc: "Never miss Jun 15, Sep 15, Dec 15, or Mar 15. Get email alerts before every quarterly deadline.",
    accent: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    icon: Download,
    title: "CA-Ready PDF Export",
    desc: "Generate professional tax reports your CA can use directly. Save hours every filing season.",
    accent: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
];

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

const STAT_PILLS = [
  { icon: IndianRupee, label: "₹0 CA Fees" },
  { icon: Globe, label: "USD → INR Auto-convert" },
  { icon: ShieldCheck, label: "Advance Tax Auto-calc" },
  { icon: Sparkles, label: "Built for India" },
];

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Tax Tools", href: "#features" },
];

// ── Component ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");

  return (
    <div
      className="min-h-screen bg-background text-foreground overflow-x-hidden"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* ─────────────────── NAV ─────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-950" />
            </div>
            <span
              className="text-lg font-extrabold tracking-tight"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              TimeTrakr
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="btn-primary-gradient inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-bold"
            >
              Get Started
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-md px-4 py-5 flex flex-col gap-4"
          >
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground py-0.5"
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <div className="border-t border-border/40 pt-4 flex flex-col gap-2">
              <Link
                href="/login"
                className="text-sm text-center font-semibold border border-border rounded-xl py-2.5 hover:bg-card transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="btn-primary-gradient text-sm text-center font-bold rounded-xl py-2.5"
              >
                Get Started Free
              </Link>
            </div>
          </motion.div>
        )}
      </header>

      {/* ─────────────────── HERO ─────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-16 overflow-hidden">
        {/* Galaxy */}
        <div className="absolute inset-0">
          <Galaxy
            hueShift={38}
            density={1.4}
            glowIntensity={0.75}
            saturation={0.95}
            mouseInteraction={true}
            mouseRepulsion={true}
            twinkleIntensity={0.5}
            rotationSpeed={0.008}
            transparent={false}
          />
        </div>

        {/* Overlay for text contrast */}
        <div className="absolute inset-0 bg-background/50" />

        {/* Radial amber glow behind headline */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, hsl(38 92% 50% / 0.08) 0%, transparent 70%)",
          }}
        />

        {/* Content */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col items-center text-center px-4 sm:px-6 max-w-5xl mx-auto"
        >
          {/* Badge */}
          <motion.div variants={fadeUp}>
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px] font-bold uppercase tracking-[0.18em] mb-8"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              <Sparkles className="w-3 h-3" />
              Built for Indian Freelancers
              <ChevronRight className="w-3 h-3 opacity-60" />
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.25rem] font-extrabold leading-[1.0] tracking-tight mb-6"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            <span
              style={{
                background:
                  "linear-gradient(180deg, hsl(220 15% 96%) 0%, hsl(220 15% 72%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Track Every Hour.
            </span>
            <br />
            <span
              style={{
                background:
                  "linear-gradient(135deg, hsl(38 92% 55%) 0%, hsl(25 95% 58%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Maximize Every Rupee.
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={fadeUp}
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed"
          >
            The earnings tracker that handles{" "}
            <span className="text-foreground font-semibold">USD ↔ INR</span>,{" "}
            <span className="text-foreground font-semibold">Advance Tax</span>,{" "}
            <span className="text-foreground font-semibold">GST</span>, and{" "}
            <span className="text-foreground font-semibold">TDS</span> — so you
            don't have to.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row gap-3 mb-14"
          >
            <Link
              href="/register"
              className="btn-primary-gradient inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl text-base font-bold shadow-xl shadow-amber-500/15"
            >
              <Sparkles className="w-4 h-4" />
              Start for Free
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl border border-border/60 bg-card/30 backdrop-blur-sm text-base font-semibold hover:bg-card/50 transition-colors"
            >
              See How It Works
              <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>

          {/* Stat pills */}
          <motion.div
            variants={fadeUp}
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
          >
            {STAT_PILLS.map((pill, i) => {
              const Icon = pill.icon;
              return (
                <motion.span
                  key={pill.label}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.85 + i * 0.09, duration: 0.45 }}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border/40 bg-card/25 backdrop-blur-sm text-xs font-semibold text-muted-foreground"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  <Icon className="w-3.5 h-3.5 text-amber-400" />
                  {pill.label}
                </motion.span>
              );
            })}
          </motion.div>
        </motion.div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5"
        >
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50" style={{ fontFamily: "'DM Mono', monospace" }}>
            Scroll
          </span>
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            className="w-px h-8 bg-gradient-to-b from-muted-foreground/30 to-transparent"
          />
        </motion.div>
      </section>

      {/* ─────────────────── FEATURES ─────────────────── */}
      <section id="features" className="py-28 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-500 mb-3"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              What's Included
            </p>
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 tracking-tight"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Everything a Freelancer Needs
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
              One tool that handles your time, money, and taxes — designed for
              the realities of India's gig economy.
            </p>
          </motion.div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.07 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="card-glass p-6 flex flex-col gap-4 group"
                >
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${f.bg} ${f.border} ${f.accent} group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3
                      className="text-base font-bold mb-1.5"
                      style={{ fontFamily: "'Syne', sans-serif" }}
                    >
                      {f.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────── PRICING ─────────────────── */}
      <section
        id="pricing"
        className="py-28 px-4 sm:px-6 relative overflow-hidden"
      >
        {/* Subtle bg glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full pointer-events-none -z-0"
          style={{
            background:
              "radial-gradient(ellipse, hsl(38 92% 50% / 0.05) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-5xl mx-auto relative z-10">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-500 mb-3"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              Simple Pricing
            </p>
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 tracking-tight"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Start Free. Upgrade When Ready.
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              No credit card required. Cancel anytime.
            </p>
          </motion.div>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {(["monthly", "annual"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  plan === p
                    ? "bg-amber-500 text-amber-950 shadow-md shadow-amber-500/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
                {p === "annual" && (
                  <span className="text-[10px] opacity-75">(save 29%)</span>
                )}
              </button>
            ))}
          </div>

          {/* Cards */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            {/* Free */}
            <div className="card-glass p-8 flex flex-col">
              <p
                className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                Free
              </p>
              <div className="flex items-end gap-1 mb-1">
                <span
                  className="text-5xl font-extrabold"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  ₹0
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-8">forever</p>

              <ul className="space-y-3 mb-8 flex-1">
                {FREE_FEATURES.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="block text-center w-full h-11 rounded-xl border border-border font-semibold text-sm leading-[2.75rem] hover:bg-card transition-colors"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div className="relative p-8 rounded-xl border-2 border-amber-400/80 bg-amber-500/[0.04] backdrop-blur-md flex flex-col">
              {/* Recommended badge */}
              <div
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-amber-500 text-amber-950 text-[10px] font-extrabold uppercase tracking-wider rounded-full whitespace-nowrap"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                Recommended
              </div>

              <p
                className="text-[11px] font-bold uppercase tracking-widest text-amber-500 mb-2"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                Pro
              </p>
              <div className="flex items-end gap-1 mb-1">
                <span
                  className="text-5xl font-extrabold"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  {plan === "monthly" ? "₹349" : "₹2,999"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-8">
                {plan === "monthly" ? "per month" : "per year"}
              </p>

              <ul className="space-y-3 mb-8 flex-1">
                {PRO_FEATURES.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="btn-primary-gradient inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/15"
              >
                <Sparkles className="w-4 h-4" />
                Start Pro — {plan === "monthly" ? "₹349/mo" : "₹2,999/yr"}
              </Link>
            </div>
          </motion.div>

          <p className="text-center text-xs text-muted-foreground mt-5">
            Cancel anytime. Access continues until end of billing period.
          </p>
        </div>
      </section>

      {/* ─────────────────── FOOTER ─────────────────── */}
      <footer className="border-t border-border/40 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-amber-950" />
              </div>
              <span
                className="font-extrabold text-sm"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                TimeTrakr
              </span>
            </div>
            <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
              The earnings tracker built for Indian freelancers earning in USD.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { label: "Sign In", href: "/login" },
              { label: "Register", href: "/register" },
              { label: "Features", href: "#features" },
              { label: "Pricing", href: "#pricing" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p
            className="text-xs text-muted-foreground"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            © {new Date().getFullYear()} TimeTrakr. All rights reserved.
          </p>
          <p
            className="text-xs text-muted-foreground"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            Made with care for 🇮🇳 freelancers
          </p>
        </div>
      </footer>
    </div>
  );
}
