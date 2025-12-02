import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LayoutDashboard, Zap, Calendar, History, Settings, ChevronDown, LogOut, User, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { EarningsCalculator } from '@/components/earnings-calculator';
import { ChangePasswordDialog } from '@/components/change-password-dialog';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const cardNavItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Quick Entry", href: "/quick-entry", icon: Zap },
  { label: "Tracking", href: "/weekly", icon: Calendar },
  { label: "History", href: "/history", icon: History },
  { label: "Settings", href: "/settings", icon: Settings },
];

const CardNav: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const getCardColor = (index: number) => {
    const colors = [
      "from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-900/30",
      "from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-900/30",
      "from-emerald-500/10 to-emerald-600/5 border-emerald-200 dark:border-emerald-900/30",
      "from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-900/30",
      "from-rose-500/10 to-rose-600/5 border-rose-200 dark:border-rose-900/30",
    ];
    return colors[index % colors.length];
  };

  const getCardAccentColor = (index: number) => {
    const colors = [
      "text-blue-600 dark:text-blue-400",
      "text-purple-600 dark:text-purple-400",
      "text-emerald-600 dark:text-emerald-400",
      "text-amber-600 dark:text-amber-400",
      "text-rose-600 dark:text-rose-400",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Top Bar */}
          <div className="flex items-center justify-between h-16 mb-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="TimeTrakr" className="h-8 w-8" />
              <span className="text-lg font-bold font-heading hidden sm:inline">TimeTrakr</span>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              <EarningsCalculator />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{(user?.fullName || user?.username || '?').charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="hidden lg:inline text-sm font-medium capitalize">{user?.fullName || user?.username}</span>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <ChangePasswordDialog trigger={
                      <div className="flex items-center w-full cursor-pointer">
                        <Lock className="mr-2 h-4 w-4" />
                        <span>Change Password</span>
                      </div>
                    } />
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950 cursor-pointer"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label={isOpen ? "Close menu" : "Open menu"}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Navigation Cards */}
          <AnimatePresence mode="wait">
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="md:hidden mb-4 space-y-2 overflow-hidden"
              >
                {cardNavItems.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Link href={item.href}>
                        <div
                          className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "bg-muted/50 hover:bg-muted text-foreground"
                          }`}
                          onClick={() => setIsOpen(false)}
                        >
                          <Icon className="w-5 h-5 flex-shrink-0" />
                          <span className="font-medium">{item.label}</span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Desktop Navigation Cards */}
          <div className="hidden md:flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {cardNavItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    className={`nav-card flex-shrink-0 flex items-center gap-3 px-6 py-3 rounded-lg border-2 transition-all cursor-pointer group ${
                      isActive
                        ? "bg-primary/10 border-primary shadow-md"
                        : `bg-gradient-to-br ${getCardColor(idx)} border hover:border-primary/30 hover:shadow-md`
                    }`}
                    whileHover={{ y: -2 }}
                    whileTap={{ y: 0 }}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-primary" : getCardAccentColor(idx)}`} />
                    <span className={`font-semibold text-sm whitespace-nowrap ${isActive ? "text-primary" : "text-foreground"}`}>
                      {item.label}
                    </span>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-screen flex flex-col">
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
};

export default CardNav;
