import * as Sentry from "@sentry/react";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import { initAnalytics } from "./lib/analytics";

// Initialize Sentry for error tracking
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Initialize analytics
initAnalytics();

import Layout from "./components/Layout";
import Home from "./pages/Home";
import Challenges from "./pages/Challenges";
import ChallengeDetail from "./pages/ChallengeDetail";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Submissions from "./pages/Submissions";
import Dashboard from "./pages/Dashboard";
import Leaderboards from "./pages/Leaderboards";
import Billing from "./pages/Billing";
import Help from "./pages/Help";
import DesignHelp from "./pages/DesignHelp";
import MetricsHelp from "./pages/MetricsHelp";
import RFDiffusionHelp from "./pages/help/RFDiffusionHelp";
import BindCraftHelp from "./pages/help/BindCraftHelp";
import BoltzGenHelp from "./pages/help/BoltzGenHelp";
import BoltzGenPlayground from "./pages/BoltzGenPlayground";
import Designer from "./pages/Designer";
import Admin from "./pages/Admin";
import HelpArticle from "./pages/HelpArticle";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Verified from "./pages/Verified";
import AcceptInvite from "./pages/AcceptInvite";
import Teams from "./pages/Teams";
import NotFound from "./pages/NotFound";
import Submit from "./pages/Submit";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import StructureViewer from "./pages/StructureViewer";

// TEMPORARY: Sentry test page - remove after testing
function SentryTest() {
  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Sentry Test</h1>
      <button
        className="bg-red-600 text-white px-4 py-2 rounded"
        onClick={() => {
          throw new Error("Test error from Frontend - Sentry integration check");
        }}
      >
        Trigger Test Error
      </button>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong. Please refresh the page.</p>}>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/challenges/:id" element={<ChallengeDetail />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/submissions" element={<Submissions />} />
            <Route path="/submit" element={<Submit />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leaderboards" element={<Leaderboards />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/help" element={<Help />} />
            <Route path="/help/design" element={<DesignHelp />} />
            <Route path="/help/design/rfdiffusion" element={<RFDiffusionHelp />} />
            <Route path="/help/design/bindcraft" element={<BindCraftHelp />} />
            <Route path="/help/design/boltzgen" element={<BoltzGenHelp />} />
          <Route path="/help/metrics" element={<MetricsHelp />} />
            <Route path="/help/:slug" element={<HelpArticle />} />
          <Route path="/design/boltzgen" element={<BoltzGenPlayground />} />
          <Route path="/design/:challengeId" element={<Designer />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/view/:type/:id" element={<StructureViewer />} />
          <Route path="/debug/sentry-test" element={<SentryTest />} />
          <Route path="*" element={<NotFound />} />
        </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verified" element={<Verified />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>
);
