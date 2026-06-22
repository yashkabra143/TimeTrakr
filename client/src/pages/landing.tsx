import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, HTMLMotionProps, Variants } from "framer-motion";
import {
  Clock, ChevronRight, Menu, X, Sparkles, ChevronDown,
  Timer, DollarSign, FileText, Calculator, Bell, Download, Check,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { EASE_SMOOTH } from "@/lib/animations";

// ─── Framer Motion spring config (from 21st.dev features component) ───────────
const SPRING = { type: "spring", stiffness: 100, damping: 16, mass: 0.75, restDelta: 0.005 } as const;

const filterVariants: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(10px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

// ─── ContainerStagger / ContainerAnimated (21st.dev pattern) ─────────────────
const ContainerStagger = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ transition, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      transition={{ staggerChildren: 0.15, delayChildren: 0.2, duration: 0.3, ...transition }}
      {...props}
    />
  )
);
ContainerStagger.displayName = "ContainerStagger";

const ContainerAnimated = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ transition, ...props }, ref) => (
    <motion.div
      ref={ref}
      variants={filterVariants}
      transition={{ ...SPRING, duration: 0.3, ...transition }}
      {...props}
    />
  )
);
ContainerAnimated.displayName = "ContainerAnimated";

// ─── BGPattern (from 21st.dev pricing component) ──────────────────────────────
type BGVariant = "dots" | "grid" | "diagonal-stripes" | "horizontal-lines" | "vertical-lines";
type BGMask = "fade-edges" | "fade-center" | "fade-top" | "fade-bottom" | "none";

const maskClasses: Record<BGMask, string> = {
  "fade-edges": "[mask-image:radial-gradient(ellipse_at_center,var(--background),transparent)]",
  "fade-center": "[mask-image:radial-gradient(ellipse_at_center,transparent,var(--background))]",
  "fade-top": "[mask-image:linear-gradient(to_bottom,transparent,var(--background))]",
  "fade-bottom": "[mask-image:linear-gradient(to_bottom,var(--background),transparent)]",
  none: "",
};

function getBgImage(variant: BGVariant, fill: string, size: number) {
  switch (variant) {
    case "dots": return `radial-gradient(${fill} 1px, transparent 1px)`;
    case "grid": return `linear-gradient(to right, ${fill} 1px, transparent 1px), linear-gradient(to bottom, ${fill} 1px, transparent 1px)`;
    case "diagonal-stripes": return `repeating-linear-gradient(45deg, ${fill}, ${fill} 1px, transparent 1px, transparent ${size}px)`;
    case "horizontal-lines": return `linear-gradient(to bottom, ${fill} 1px, transparent 1px)`;
    case "vertical-lines": return `linear-gradient(to right, ${fill} 1px, transparent 1px)`;
  }
}

function BGPattern({ variant = "dots", mask = "none", size = 24, fill = "#252525", className, style, ...props }:
  React.ComponentProps<"div"> & { variant?: BGVariant; mask?: BGMask; size?: number; fill?: string }) {
  return (
    <div
      className={cn("absolute inset-0 z-[-10] size-full", maskClasses[mask], className)}
      style={{ backgroundImage: getBgImage(variant, fill, size), backgroundSize: `${size}px ${size}px`, ...style }}
      {...props}
    />
  );
}

// ─── 1. FLOATING NAVBAR (21st.dev) ────────────────────────────────────────────
const NAV_LINKS = [
  { name: "Features", href: "#features" },
  { name: "Pricing", href: "#pricing" },
  { name: "Tax Tools", href: "#features" },
];

function AnimatedNavLink({ name, href }: { name: string; href: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      className="relative h-6 overflow-hidden block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={hovered ? "h" : "n"}
          initial={{ y: hovered ? 24 : -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: hovered ? -24 : 24, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="block text-white/70 hover:text-white text-sm font-medium"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {name}
        </motion.span>
      </AnimatePresence>
    </a>
  );
}

function FloatingNavbar() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => { setIsMobile(window.innerWidth < 768); if (window.innerWidth >= 768) setOpen(false); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl">
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={cn(
          "relative backdrop-blur-xl bg-[#0B0C10]/80 border border-white/10 shadow-2xl transition-all duration-300",
          open ? "rounded-xl" : "rounded-full"
        )}
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        <div className="flex items-center justify-between px-6 py-3 md:py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#0B0C10]" strokeWidth={2.5} />
            </div>
            <span className="text-white font-bold text-lg">TimeTrakr</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => <AnimatedNavLink key={l.name} {...l} />)}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-white/70 hover:text-white text-sm font-medium px-4 py-2 hover:bg-white/10 rounded-full transition-colors">
              Sign In
            </Link>
            <Link
              href="/register"
              className="group relative overflow-hidden inline-flex items-center bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-[#0B0C10] hover:from-[#D97706] hover:to-[#F59E0B] font-semibold rounded-full px-5 py-2 text-sm transition-all"
            >
              <span className="mr-6 transition-opacity duration-300 group-hover:opacity-0">Get Started</span>
              <i className="absolute right-1 top-1 bottom-1 rounded-full z-10 grid w-7 place-items-center bg-[#0B0C10]/20 transition-all duration-300 group-hover:w-[calc(100%-0.5rem)]">
                <ChevronRight size={14} strokeWidth={2.5} />
              </i>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className="overflow-hidden md:hidden border-t border-white/10"
            >
              <div className="px-6 py-4 space-y-4">
                {NAV_LINKS.map((l) => (
                  <a key={l.name} href={l.href} className="block text-white/70 hover:text-white font-medium py-1.5 text-sm"
                    onClick={() => setOpen(false)}>{l.name}</a>
                ))}
                <div className="pt-4 space-y-2 border-t border-white/10">
                  <Link href="/login" className="block w-full text-center text-white/70 hover:text-white font-medium py-2.5 text-sm border border-white/10 rounded-xl hover:bg-white/5 transition-colors">
                    Sign In
                  </Link>
                  <Link href="/register" className="block w-full text-center bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-[#0B0C10] font-bold py-2.5 text-sm rounded-xl">
                    Get Started Free
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </div>
  );
}

// ─── 2. HERO with canvas particle field (21st.dev) ────────────────────────────
function ParticleStarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const colors = ["#fbbf24", "#f59e0b", "#d97706", "#b45309", "#fff7ed"];
    const particles = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.8 + 0.4,
      speedY: Math.random() * 0.45 + 0.08,
      opacity: Math.random() * 0.55 + 0.25,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let raf: number;
    const draw = () => {
      ctx.fillStyle = "rgba(11, 12, 16, 0.06)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        p.y -= p.speedY;
        if (p.y < 0) { p.y = canvas.height; p.x = Math.random() * canvas.width; }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

const heroContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
};
const heroItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_SMOOTH } },
};

const STAT_PILLS = [
  { value: "₹0", label: "CA Fees" },
  { value: "USD→INR", label: "Live Convert" },
  { value: "194J", label: "TDS Tracking" },
  { value: "Q4 Alert", label: "Advance Tax" },
];

function HeroSection() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#0B0C10]">
      <ParticleStarField />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0B0C10]/50 to-[#0B0C10]" />

      <motion.div
        variants={heroContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 container mx-auto px-4 md:px-6 max-w-5xl"
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        <div className="flex flex-col items-center text-center gap-8">
          {/* Badge */}
          <motion.div variants={heroItem}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-500 tracking-wide">Built for Indian Freelancers</span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div variants={heroItem}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.08]">
              <span className="block bg-gradient-to-b from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                Track Every Hour.
              </span>
              <span className="block bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                Maximize Every Rupee.
              </span>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.p variants={heroItem} className="max-w-2xl text-lg md:text-xl text-gray-400 leading-relaxed">
            The complete <strong className="text-white font-semibold">time tracking app for Indian freelancers</strong> — handles{" "}
            <span className="text-white font-semibold">USD ↔ INR</span>,{" "}
            <span className="text-white font-semibold">Advance Tax</span>,{" "}
            <span className="text-white font-semibold">GST</span>, and{" "}
            <span className="text-white font-semibold">TDS</span> automatically.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={heroItem} className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/register"
              aria-label="Start tracking time for free — no credit card required"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-8 py-4 text-base rounded-full shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/40 transition-all"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Start for Free
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white font-semibold px-8 py-4 text-base rounded-full border border-white/10 hover:bg-white/5 transition-all"
            >
              See How It Works
              <ChevronRight className="w-4 h-4" />
            </a>
          </motion.div>

          {/* Stat pills */}
          <motion.div variants={heroItem} className="flex flex-wrap items-center justify-center gap-3">
            {STAT_PILLS.map((s) => (
              <div
                key={s.label}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm"
              >
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="text-sm font-semibold text-white/80">
                  {s.value} <span className="text-white/40 font-normal">{s.label}</span>
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-xs text-amber-500/50 font-semibold tracking-[0.2em]" style={{ fontFamily: "'Montserrat', sans-serif" }}>SCROLL</span>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
          <ChevronDown className="w-5 h-5 text-amber-500/50" />
        </motion.div>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0B0C10] to-transparent pointer-events-none" />
    </div>
  );
}

// ─── 3. FEATURES GRID (21st.dev) ─────────────────────────────────────────────
const FEATURES = [
  { icon: <Timer className="size-6" />, title: "Time Tracking", description: "Log hours in H.MM format across projects. USD hourly rates with instant INR conversion.", iconColor: "text-amber-500", iconBg: "bg-amber-500/10" },
  { icon: <DollarSign className="size-6" />, title: "Earnings Dashboard", description: "Real-time income overview with daily, weekly, and monthly breakdowns and charts.", iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10" },
  { icon: <FileText className="size-6" />, title: "GST Tracker", description: "Auto-calculate 18% GST on eligible income. Stay compliant without a CA.", iconColor: "text-blue-500", iconBg: "bg-blue-500/10" },
  { icon: <Calculator className="size-6" />, title: "TDS Reconciliation", description: "Log Section 194J deductions and reconcile against your Advance Tax liability.", iconColor: "text-violet-500", iconBg: "bg-violet-500/10" },
  { icon: <Bell className="size-6" />, title: "Tax Reminders", description: "Email alerts before Jun 15, Sep 15, Dec 15, Mar 15 quarterly deadlines.", iconColor: "text-orange-500", iconBg: "bg-orange-500/10" },
  { icon: <Download className="size-6" />, title: "CA-Ready PDF Export", description: "Professional tax reports your CA can use directly — saves hours every season.", iconColor: "text-rose-500", iconBg: "bg-rose-500/10" },
];

function FeaturesSection() {
  return (
    <section id="features" className="w-full bg-[#0B0C10] py-24 px-4 sm:px-6 lg:px-8" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <div className="mx-auto max-w-7xl">
        <ContainerStagger className="mb-14 text-center">
          <ContainerAnimated>
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-amber-500 mb-3 block">
              Powerful Features
            </span>
          </ContainerAnimated>
          <ContainerAnimated>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Everything an Indian Freelancer Needs
            </h2>
          </ContainerAnimated>
          <ContainerAnimated>
            <p className="mx-auto max-w-2xl text-lg text-gray-400">
              One tool that handles your time, money, and taxes — designed for the realities of India's gig economy.
            </p>
          </ContainerAnimated>
        </ContainerStagger>

        <ContainerStagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <ContainerAnimated
              key={i}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-neutral-900/40 backdrop-blur-xl p-6 shadow-xl transition-all duration-300"
              whileHover={{ y: -4 }}
            >
              <div className={cn("mb-4 inline-flex items-center justify-center rounded-lg p-3 transition-transform duration-300 group-hover:scale-110", f.iconBg)}>
                <div className={cn("size-6", f.iconColor)} aria-hidden="true">{f.icon}</div>
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.description}</p>
            </ContainerAnimated>
          ))}
        </ContainerStagger>
      </div>
    </section>
  );
}

// ─── 4. PRICING SECTION (21st.dev) ────────────────────────────────────────────
const FREE_FEATURES = ["Unlimited time entries", "Unlimited projects", "Dashboard & analytics", "Withdrawal tracking", "Advance Tax scheduler"];
const PRO_FEATURES = ["Everything in Free", "GST liability tracker", "TDS reconciliation", "Tax email reminders", "CSV import (Upwork)", "CA-ready PDF export"];

function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section id="pricing" className="relative min-h-fit w-full bg-[#09090b] text-white overflow-hidden py-24 px-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-amber-500/8 rounded-full blur-[120px]" />
      </div>
      <BGPattern variant="dots" mask="fade-edges" fill="#27272a" size={32} className="opacity-25" />

      <div className="relative z-10 container mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-500 mb-3">Simple Pricing</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Start Free. Upgrade When Ready.</h2>
          <p className="text-gray-400 text-lg mb-8">No credit card required. Cancel anytime.</p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-1 bg-zinc-900/60 backdrop-blur-sm border border-zinc-800 rounded-full p-1">
            {(["Monthly", "Annual"] as const).map((label) => {
              const active = label === "Annual" ? isAnnual : !isAnnual;
              return (
                <button
                  key={label}
                  onClick={() => setIsAnnual(label === "Annual")}
                  className={cn(
                    "px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 flex items-center gap-1.5",
                    active ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-white"
                  )}
                >
                  {label}
                  {label === "Annual" && <span className="text-[10px] opacity-70">(save 29%)</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Free */}
          <div className="relative rounded-2xl p-8 bg-zinc-900/40 border border-zinc-800 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Free</p>
            <div className="mb-6">
              <span className="text-5xl font-bold text-white">₹0</span>
              <span className="text-zinc-400 ml-2">/forever</span>
            </div>
            <ul className="space-y-3.5 mb-8">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-zinc-300 text-sm">{f}</span>
                </li>
              ))}
            </ul>
            <Link href="/register" className="block text-center w-full py-3 rounded-xl border-2 border-zinc-700 hover:border-zinc-500 text-white font-semibold text-sm transition-all">
              Get Started Free
            </Link>
          </div>

          {/* Pro */}
          <div className="relative rounded-2xl p-8 bg-zinc-900/80 border-2 border-amber-500 shadow-[0_0_50px_rgba(251,191,36,0.12)] backdrop-blur-sm">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-zinc-950 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              Recommended
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">Pro</p>
            <div className="mb-6">
              <span className="text-5xl font-bold text-amber-500">
                {isAnnual ? "₹2,999" : "₹349"}
              </span>
              <span className="text-zinc-400 ml-2">/{isAnnual ? "year" : "month"}</span>
            </div>
            <ul className="space-y-3.5 mb-8">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-zinc-300 text-sm">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Start Pro — {isAnnual ? "₹2,999/yr" : "₹349/mo"}
            </Link>
          </div>
        </div>
        <p className="text-center text-zinc-500 text-xs mt-6">Cancel anytime. Access continues until end of billing period.</p>
      </div>
    </section>
  );
}

// ─── 5. FOOTER ────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 px-4 sm:px-6 bg-[#0B0C10]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-[#0B0C10]" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-white text-sm">TimeTrakr</span>
          </div>
          <p className="text-xs text-zinc-500 max-w-[240px] leading-relaxed">
            The earnings tracker built for Indian freelancers earning in USD.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {[{ label: "Sign In", href: "/login" }, { label: "Register", href: "/register" }, { label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }].map((l) => (
            <a key={l.label} href={l.href} className="text-xs text-zinc-500 hover:text-white transition-colors">{l.label}</a>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-zinc-600">© {new Date().getFullYear()} TimeTrakr. All rights reserved.</p>
        <p className="text-xs text-zinc-600">Made with care for 🇮🇳 freelancers</p>
      </div>
    </footer>
  );
}

// ─── PAGE ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0B0C10] text-white overflow-x-hidden">
      <FloatingNavbar />
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <Footer />
    </div>
  );
}
