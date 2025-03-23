import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Exercise from "@/pages/exercise";
import Results from "@/pages/results";
import Run from "@/pages/run";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";

function Router() {
  return (
    <div className="min-h-screen flex flex-col">
      <Switch>
        <Route path="/login">
          <Login />
        </Route>
        <Route path="/register">
          <Register />
        </Route>
        <Route>
          <>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 sm:pb-8">
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/exercise/:type" component={Exercise} />
                <Route path="/results/:id" component={Results} />
                <Route path="/run" component={Run} />
                <Route component={NotFound} />
              </Switch>
            </main>
            <MobileNav />
          </>
        </Route>
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
