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
import Leaderboard from "@/pages/leaderboard";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";

import Pushups from "@/pages/pushups";
import Pullups from "@/pages/pullups";
import Situps from "@/pages/situps";

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
        <Route path="/pushups">
          <>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 sm:pb-8">
              <Pushups />
            </main>
            <MobileNav />
          </>
        </Route>
        <Route path="/pullups">
          <>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 sm:pb-8">
              <Pullups />
            </main>
            <MobileNav />
          </>
        </Route>
        <Route path="/situps">
          <>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 sm:pb-8">
              <Situps />
            </main>
            <MobileNav />
          </>
        </Route>
        <Route path="/run">
          <>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 sm:pb-8">
              <Run />
            </main>
            <MobileNav />
          </>
        </Route>
        <Route path="/results/:id">
          <>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 sm:pb-8">
              <Results />
            </main>
            <MobileNav />
          </>
        </Route>
        <Route path="/leaderboard">
          <>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 sm:pb-8">
              <Leaderboard />
            </main>
            <MobileNav />
          </>
        </Route>
        <Route path="/">
          <>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 sm:pb-8">
              <Dashboard />
            </main>
            <MobileNav />
          </>
        </Route>
        <Route>
          <>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 sm:pb-8">
              <NotFound />
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
