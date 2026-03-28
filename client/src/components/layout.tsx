import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Zap,
  Calendar,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
  User,
  Lock,
  History,
  Timer,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EarningsCalculator } from "@/components/earnings-calculator";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { pageVariants } from "@/lib/animations";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Quick Entry", href: "/quick-entry", icon: Zap },
  { label: "Weekly", href: "/weekly", icon: Calendar },
  { label: "History", href: "/history", icon: History },
  { label: "Tax", href: "/tax", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
];

function UserAvatar({ user, size = "sm" }: { user: any; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  const textSize = size === "sm" ? "text-[10px]" : "text-sm";
  const initial = (user?.fullName || user?.username || "?").charAt(0).toUpperCase();

  if (user?.profilePicture) {
    return (
      <img
        src={user.profilePicture}
        alt={user.fullName || user.username}
        className={cn(dim, "rounded-full object-cover")}
      />
    );
  }
  return (
    <div
      className={cn(
        dim,
        "rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0"
      )}
    >
      <span className={cn(textSize, "font-bold font-mono text-primary")}>{initial}</span>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
    setIsMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Top Navbar ── */}
      <header className="sticky top-0 z-50">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-background/85 backdrop-blur-xl border-b border-border/60" />

        <div className="relative flex items-center h-16 px-4 md:px-8 max-w-7xl mx-auto w-full">
          {/* Brand */}
          <Link href="/">
            <div className="flex items-center gap-3 shrink-0 cursor-pointer select-none">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/30">
                <Timer className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div className="hidden sm:flex flex-col leading-none">
                <span
                  className="text-[11px] font-mono font-medium text-muted-foreground tracking-[0.18em] uppercase"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  TIMETRAKR
                </span>
                <span
                  className="text-[10px] font-mono text-primary/70 tracking-wider"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  by Yash
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-end gap-0.5 flex-1 ml-10 h-full pb-0">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "relative flex items-center gap-2 px-4 h-16 cursor-pointer transition-colors duration-150",
                      active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="w-[15px] h-[15px] shrink-0" strokeWidth={active ? 2.5 : 2} />
                    <span className="text-[13px] font-semibold tracking-tight"
                      style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {item.label}
                    </span>
                    {active && (
                      <motion.div
                        layoutId="nav-underline"
                        className="absolute bottom-0 left-2 right-2 h-[2px] rounded-t-full"
                        style={{ background: "hsl(var(--primary))" }}
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Earnings Calculator */}
            <div className="hidden sm:block">
              <EarningsCalculator />
            </div>

            {/* User dropdown */}
            <div className="hidden sm:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50">
                    <UserAvatar user={user} size="sm" />
                    <span
                      className="hidden md:inline text-sm font-semibold capitalize max-w-[120px] truncate"
                      style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                      {user?.fullName || user?.username}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/70 ml-0.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52" sideOffset={8}>
                  <div className="px-3 py-2.5 border-b border-border/60 mb-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono mb-0.5">
                      Signed in as
                    </p>
                    <p className="text-sm font-semibold capitalize truncate">
                      {user?.fullName || user?.username}
                    </p>
                  </div>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <ChangePasswordDialog
                      trigger={
                        <div className="flex items-center w-full cursor-pointer">
                          <Lock className="mr-2 h-4 w-4" />
                          Change Password
                        </div>
                      }
                    />
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile hamburger */}
            <button
              className={cn(
                "md:hidden w-9 h-9 flex items-center justify-center rounded-lg border transition-all duration-150",
                isMobileOpen
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 hover:bg-muted/50 text-foreground"
              )}
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Overlay Menu ── */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setIsMobileOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-72 bg-card border-l border-border md:hidden flex flex-col"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
                    <Timer className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                  <span
                    className="text-[11px] font-mono text-muted-foreground tracking-[0.18em] uppercase"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  >
                    TIMETRAKR
                  </span>
                </div>
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted/60 transition-colors"
                  onClick={() => setIsMobileOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Nav items */}
              <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                <div className="mb-4 pb-4 border-b border-border/60">
                  <EarningsCalculator />
                </div>

                {NAV_ITEMS.map((item, i) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                    >
                      <Link href={item.href}>
                        <div
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 cursor-pointer",
                            active
                              ? "bg-primary/10 border border-primary/20 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                          )}
                          onClick={() => setIsMobileOpen(false)}
                        >
                          <Icon
                            className="w-4 h-4 shrink-0"
                            strokeWidth={active ? 2.5 : 2}
                          />
                          <span className="font-semibold text-sm">{item.label}</span>
                          {active && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Drawer footer */}
              <div className="p-4 border-t border-border/60 space-y-2">
                {/* User card */}
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30">
                  <UserAvatar user={user} size="md" />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono mb-0.5"
                    >
                      Freelancer
                    </p>
                    <p className="text-sm font-semibold capitalize truncate">
                      {user?.fullName || user?.username}
                    </p>
                  </div>
                </div>

                <Link href="/profile">
                  <div
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </div>
                </Link>

                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors font-medium"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <main className="flex-1">
        <motion.div
          key={location}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="p-4 md:p-8 max-w-7xl mx-auto w-full"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
