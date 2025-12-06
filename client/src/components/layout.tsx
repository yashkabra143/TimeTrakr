import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
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
  History
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuthStore } from "@/stores/auth-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { EarningsCalculator } from "@/components/earnings-calculator";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import Galaxy from "@/components/galaxy";


const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Quick Entry", href: "/quick-entry", icon: Zap },
  { label: "Weekly Tracking", href: "/weekly", icon: Calendar },
  { label: "History", href: "/history", icon: History },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const NavLink = ({ item }: { item: typeof NAV_ITEMS[0] }) => {
    const Icon = item.icon;
    const isActive = location === item.href;

    return (
      <Link href={item.href}>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer text-sm font-medium",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{item.label}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between h-16 px-4 md:px-8 max-w-7xl mx-auto w-full">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden text-primary">
              <img src="/logo.svg" alt="Upwork Tracker" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col hidden sm:block">
              <h1 className="text-xs uppercase font-bold font-heading tracking-tight text-muted-foreground">Yash</h1>
              <h1 className="text-sm font-bold font-heading tracking-tight">Upwork Tracker</h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 flex-1 ml-8">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          {/* Right Side - Calculator, User Profile and Mobile Menu */}
          <div className="flex items-center gap-4 ml-auto">
            {/* Calculator */}
            <div className="hidden sm:block">
              <EarningsCalculator />
            </div>

            {/* Desktop User Profile */}
            <div className="hidden sm:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{(user?.fullName || user?.username || '?').charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="hidden md:inline text-sm font-medium capitalize">{user?.fullName || user?.username}</span>
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
                    onClick={async () => {
                      await logout();
                      navigate("/login");
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Menu */}
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="outline" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="p-0 w-64 border-l border-border">
                <div className="flex flex-col h-full bg-background">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <h2 className="font-semibold">Menu</h2>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <X className="w-5 h-5" />
                      </Button>
                    </SheetTrigger>
                  </div>

                  <nav className="flex-1 p-4 space-y-2">
                    <div className="mb-4 pb-4 border-b border-border">
                      <EarningsCalculator />
                    </div>
                    {NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.href;

                      return (
                        <Link key={item.href} href={item.href}>
                          <div
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer group",
                              isActive
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setIsMobileOpen(false)}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="font-medium">{item.label}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="p-4 border-t border-border space-y-3">
                    <div className="bg-muted rounded-lg p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">{(user?.fullName || user?.username || '?').charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5 truncate">Upwork Freelancer</p>
                        <p className="text-sm font-semibold truncate capitalize">{user?.fullName || user?.username}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={async () => {
                        await logout();
                        navigate("/login");
                        setIsMobileOpen(false);
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
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
}
