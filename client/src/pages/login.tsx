import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Lock, Mail, ArrowRight } from "lucide-react";


export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const login = useAuthStore((state) => state.login);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });

      login(data.user);
      navigate("/");
    } catch (error) {
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
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Background Gradient Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl"></div>
      </div>

      {/* Background Texture Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
        backgroundImage: "url('data:image/svg+xml,%3Csvg width=%2260%27 height=%2760%27 viewBox=%270 0 60 60%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cg fill=%27none%27 fill-rule=%27evenodd%27%3E%3Cg fill=%27%23000000%27 fill-opacity=%270.1%27%3E%3Cpath d=%27M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%27/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')"
      }}></div>

      <div className="relative min-h-screen flex">
        {/* Left Side - Illustration & Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/95 to-primary/85 items-center justify-center p-12 relative overflow-hidden" style={{
          backgroundImage: `linear-gradient(135deg, rgba(91, 78, 255, 0.95) 0%, rgba(91, 78, 255, 0.85) 100%)`
        }}>
          {/* Animated Background Pattern */}
          <div className="absolute inset-0">
            <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-2xl transform -rotate-45 animate-pulse"></div>
            <div className="absolute bottom-20 right-20 w-32 h-32 bg-white/5 rounded-full animate-bounce" style={{ animationDelay: "0.5s" }}></div>
            <div className="absolute top-1/2 left-1/4 w-24 h-24 border-2 border-white/10 rounded-full transform -rotate-12 animate-pulse" style={{ animationDelay: "1s" }}></div>
          </div>

          {/* Illustration SVG */}
          <div className="relative z-10 max-w-md">
            <svg viewBox="0 0 400 400" className="w-full h-auto animate-float" xmlns="http://www.w3.org/2000/svg">
              {/* Hourglass Illustration */}
              <defs>
                <linearGradient id="glassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
                </linearGradient>
              </defs>

              {/* Sand particles animation concept */}
              <circle cx="200" cy="200" r="180" fill="none" stroke="white" strokeWidth="0.5" opacity="0.1" />
              <circle cx="200" cy="200" r="140" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />

              {/* Hourglass top bulb */}
              <ellipse cx="200" cy="120" rx="50" ry="55" fill="url(#glassGradient)" stroke="white" strokeWidth="2" />
              {/* Hourglass bottom bulb */}
              <ellipse cx="200" cy="280" rx="50" ry="55" fill="url(#glassGradient)" stroke="white" strokeWidth="2" opacity="0.6" />

              {/* Connecting tube */}
              <rect x="190" y="160" width="20" height="80" fill="url(#glassGradient)" stroke="white" strokeWidth="2" />

              {/* Sand particles flowing */}
              <g className="animate-pulse">
                <rect x="185" y="165" width="4" height="4" fill="white" opacity="0.8" />
                <rect x="195" y="170" width="4" height="4" fill="white" opacity="0.6" />
                <rect x="190" y="180" width="4" height="4" fill="white" opacity="0.7" />
                <rect x="200" y="185" width="4" height="4" fill="white" opacity="0.5" />
                <rect x="185" y="200" width="4" height="4" fill="white" opacity="0.8" />
              </g>

              {/* Frame ornament */}
              <circle cx="160" cy="200" r="3" fill="white" opacity="0.4" />
              <circle cx="240" cy="200" r="3" fill="white" opacity="0.4" />
            </svg>

            {/* Floating Cards */}
            <div className="absolute -bottom-20 -left-10 bg-white/10 backdrop-blur-md rounded-2xl p-4 w-40 shadow-xl transform hover:scale-105 transition-transform duration-300 animate-float" style={{ animationDelay: "1s" }}>
              <p className="text-white text-xs font-semibold">Track Hours</p>
              <p className="text-white/70 text-xs">Monitor your productivity</p>
            </div>

            <div className="absolute top-32 -right-5 bg-white/10 backdrop-blur-md rounded-2xl p-4 w-40 shadow-xl transform hover:scale-105 transition-transform duration-300 animate-float" style={{ animationDelay: "0.5s" }}>
              <p className="text-white text-xs font-semibold">Earnings</p>
              <p className="text-white/70 text-xs">Calculate income instantly</p>
            </div>
          </div>

          {/* Text Content */}
          <div className="absolute bottom-10 left-0 right-0 text-center z-10">
            <h2 className="text-white text-2xl font-heading font-bold mb-2">Time Tracking Made Simple</h2>
            <p className="text-white/80 text-sm">Track your hours, manage earnings, and boost productivity</p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 md:p-12 relative" style={{
          backgroundImage: `
            linear-gradient(180deg, rgba(250, 128, 114, 0.03) 0%, rgba(250, 128, 114, 0.02) 50%, transparent 100%),
            radial-gradient(circle at 20% 50%, rgba(91, 78, 255, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(250, 128, 114, 0.05) 0%, transparent 50%)
          `
        }}>
          {/* Decorative Background Elements */}
          <div className="absolute top-10 right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-60 h-60 bg-accent/5 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 right-1/4 w-32 h-32 border border-primary/10 rounded-full"></div>

          <div className="w-full max-w-sm relative z-10">
            {/* Logo Section */}
            <div className="flex flex-col items-center gap-4 mb-10 animate-slide-in">
              <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg ring-2 ring-primary/20 hover:ring-primary/40 transition-all duration-300 bg-white p-2">
                <img src="/logo.svg" alt="Upwork Tracker" className="w-full h-full object-contain" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Welcome</p>
                <h1 className="text-3xl font-heading font-bold text-foreground">Upwork Tracker</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your time, maximize your earnings</p>
              </div>
            </div>

            {/* Form Card */}
            <div className="bg-card rounded-2xl shadow-lg border border-border/50 backdrop-blur-sm p-8 md:p-10 animate-slide-in" style={{ animationDelay: "0.1s" }}>
              <div className="mb-8">
                <h2 className="text-2xl font-heading font-bold text-foreground mb-2">Sign In</h2>
                <p className="text-sm text-muted-foreground">Enter your credentials to access your account</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                {/* Username Input */}
                <div className="space-y-2 animate-slide-in" style={{ animationDelay: "0.2s" }}>
                  <label htmlFor="login-username" className="text-sm font-semibold text-foreground block">
                    Username
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
                    <Input
                      id="login-username"
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      className="pl-12 h-12 bg-muted/30 border-border/50 focus:bg-muted/50 focus:border-primary transition-all duration-300 rounded-lg"
                      required
                      data-testid="input-username"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-2 animate-slide-in" style={{ animationDelay: "0.3s" }}>
                  <label htmlFor="login-password" className="text-sm font-semibold text-foreground block">
                    Password
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="pl-12 h-12 bg-muted/30 border-border/50 focus:bg-muted/50 focus:border-primary transition-all duration-300 rounded-lg"
                      required
                      data-testid="input-password"
                    />
                  </div>
                </div>

                {/* Login Button */}
                <Button
                  type="submit"
                  disabled={isLoading || !username || !password}
                  className="w-full h-12 text-base font-semibold rounded-lg group animate-slide-in hover:shadow-lg transition-all duration-300 mt-8"
                  style={{ animationDelay: "0.4s" }}
                  data-testid="button-login"
                >
                  <span>{isLoading ? "Signing in..." : "Sign In"}</span>
                  {!isLoading && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />}
                </Button>
              </form>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center animate-slide-in" style={{ animationDelay: "0.5s" }}>
              <p className="text-xs text-muted-foreground">
                © 2025 Yash Upwork Tracker. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
