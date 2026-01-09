import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import { initAnalytics } from "./lib/analytics";

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
import HelpArticle from "./pages/HelpArticle";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Verified from "./pages/Verified";
import NotFound from "./pages/NotFound";
import Submit from "./pages/Submit";

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
          <Route path="*" element={<NotFound />} />
        </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verified" element={<Verified />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>
);
