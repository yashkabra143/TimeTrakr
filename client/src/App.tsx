import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import QuickEntry from "@/pages/quick-entry";
import Weekly from "@/pages/weekly";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import TaxPage from "@/pages/tax";
import Billing from "@/pages/billing";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";

// Protected route wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function App() {
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initialize = useAuthStore((state) => state.initialize);
  const [location] = useLocation();

  // Initialize auth state on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        {/* Auth routes - redirect to dashboard if already authenticated */}
        <Route path="/login">
          {isAuthenticated ? <Redirect to="/" /> : <Login />}
        </Route>
        <Route path="/register">
          {isAuthenticated ? <Redirect to="/" /> : <Register />}
        </Route>

        {/* Protected routes */}
        <Route path="/">
          <ProtectedRoute component={Dashboard} />
        </Route>
        <Route path="/quick-entry">
          <ProtectedRoute component={QuickEntry} />
        </Route>
        <Route path="/weekly">
          <ProtectedRoute component={Weekly} />
        </Route>
        <Route path="/history">
          <ProtectedRoute component={History} />
        </Route>
        <Route path="/settings">
          <ProtectedRoute component={Settings} />
        </Route>
        <Route path="/profile">
          <ProtectedRoute component={Profile} />
        </Route>
        <Route path="/tax">
          <ProtectedRoute component={TaxPage} />
        </Route>
        <Route path="/billing">
          <ProtectedRoute component={Billing} />
        </Route>

        {/* 404 route */}
        <Route path="/:rest*">
          {isAuthenticated ? (
            <Layout>
              <NotFound />
            </Layout>
          ) : (
            <Redirect to="/login" />
          )}
        </Route>
      </Switch>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
