/**
 * React Query hooks for API data fetching
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { challengesApi, usersApi, jobsApi, submissionsApi, billingApi, suggestionsApi, referenceBindersApi, helpApi, type SuggestionRequest, type LeaderboardSortBy } from "./api";

// Query keys for cache management
export const queryKeys = {
  challenges: ["challenges"] as const,
  challenge: (id: string) => ["challenges", id] as const,
  leaderboard: (id: string, sortBy?: LeaderboardSortBy) =>
    ["challenges", id, "leaderboard", sortBy] as const,
  referenceBinders: (challengeId: string) => ["challenges", challengeId, "referenceBinders"] as const,
  referenceBinder: (id: string) => ["referenceBinders", id] as const,
  helpArticle: (slug: string) => ["help", slug] as const,
  user: ["user"] as const,
  jobs: ["jobs"] as const,
  job: (id: string) => ["jobs", id] as const,
  submissions: ["submissions"] as const,
  submission: (id: string) => ["submissions", id] as const,
  depositPresets: ["depositPresets"] as const,
  gpuPricing: ["gpuPricing"] as const,
  transactions: ["transactions"] as const,
};

// Challenge hooks
export function useChallenges() {
  return useQuery({
    queryKey: queryKeys.challenges,
    queryFn: async () => {
      const data = await challengesApi.list();
      return data.challenges;
    },
  });
}

export function useChallenge(id: string) {
  return useQuery({
    queryKey: queryKeys.challenge(id),
    queryFn: async () => {
      const data = await challengesApi.get(id);
      return data.challenge;
    },
    enabled: !!id,
  });
}

export function useLeaderboard(
  challengeId: string,
  options?: { sortBy?: LeaderboardSortBy; limit?: number; enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.leaderboard(challengeId, options?.sortBy),
    queryFn: async () => {
      const data = await challengesApi.leaderboard(challengeId, {
        sortBy: options?.sortBy,
        limit: options?.limit,
      });
      return data;
    },
    enabled: options?.enabled !== false && !!challengeId,
  });
}

// User hooks
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: async () => {
      const data = await usersApi.me();
      return data.user;
    },
    retry: false, // Don't retry on 401
  });
}

// Job hooks
export function useJobs() {
  return useQuery({
    queryKey: queryKeys.jobs,
    queryFn: async () => {
      const data = await jobsApi.list();
      return data.jobs;
    },
    refetchInterval: (query) => {
      const jobs = query.state.data;
      if (!jobs) return false;
      const hasActive = jobs.some(
        (job) => job.status === "pending" || job.status === "running"
      );
      return hasActive ? 5000 : false;
    },
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: queryKeys.job(id),
    queryFn: async () => {
      const data = await jobsApi.get(id);
      return data.job;
    },
    enabled: !!id,
    // Poll for status updates if job is pending/running
    refetchInterval: (query) => {
      const job = query.state.data;
      if (job?.status === "pending" || job?.status === "running") {
        return 2000; // Poll every 2 seconds
      }
      return false;
    },
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: jobsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
      queryClient.invalidateQueries({ queryKey: queryKeys.user }); // Balance may change after job
    },
  });
}

// Submission hooks
export function useSubmissions() {
  return useQuery({
    queryKey: queryKeys.submissions,
    queryFn: async () => {
      const data = await submissionsApi.list();
      return data.submissions;
    },
    // Poll for status updates if any submission is pending/running
    refetchInterval: (query) => {
      const submissions = query.state.data;
      if (!submissions) return false;
      const hasActive = submissions.some(
        (s) => s.status === "pending" || s.status === "running"
      );
      return hasActive ? 3000 : false; // Poll every 3 seconds
    },
  });
}

export function useSubmission(id: string) {
  return useQuery({
    queryKey: queryKeys.submission(id),
    queryFn: async () => {
      const data = await submissionsApi.get(id);
      return data.submission;
    },
    enabled: !!id,
    // Poll for status updates if submission is pending/running
    refetchInterval: (query) => {
      const submission = query.state.data;
      if (submission?.status === "pending" || submission?.status === "running") {
        return 2000; // Poll every 2 seconds
      }
      return false;
    },
  });
}

export function useCreateSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submissionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.submissions });
    },
  });
}

export function useRetrySubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submissionsApi.retry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.submissions });
    },
  });
}

// Billing hooks
export function useDepositPresets() {
  return useQuery({
    queryKey: queryKeys.depositPresets,
    queryFn: async () => {
      const data = await billingApi.getPresets();
      return data.presets;
    },
  });
}

export function useGpuPricing() {
  return useQuery({
    queryKey: queryKeys.gpuPricing,
    queryFn: async () => {
      const data = await billingApi.getPricing();
      return data.pricing;
    },
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: async () => {
      const data = await billingApi.getTransactions();
      return data.transactions;
    },
  });
}

export function useCreateDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: billingApi.createDeposit,
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onSettled: () => {
      // Refresh user data after deposit
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    },
  });
}

// Suggestions hook
export function useSuggestions(request: SuggestionRequest | null) {
  return useQuery({
    queryKey: ["suggestions", request],
    queryFn: async () => {
      if (!request) return { suggestions: [] };
      const data = await suggestionsApi.getSuggestions(request);
      return data;
    },
    enabled: !!request,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1,
  });
}

// Reference binders hooks
export function useReferenceBinders(challengeId: string) {
  return useQuery({
    queryKey: queryKeys.referenceBinders(challengeId),
    queryFn: async () => {
      const data = await referenceBindersApi.forChallenge(challengeId);
      return data.referenceBinders;
    },
    enabled: !!challengeId,
  });
}

export function useReferenceBinder(id: string) {
  return useQuery({
    queryKey: queryKeys.referenceBinder(id),
    queryFn: async () => {
      const data = await referenceBindersApi.get(id);
      return data;
    },
    enabled: !!id,
  });
}

// Help article hooks
export function useHelpArticle(slug: string) {
  return useQuery({
    queryKey: queryKeys.helpArticle(slug),
    queryFn: async () => {
      const data = await helpApi.get(slug);
      return data.article;
    },
    enabled: !!slug,
  });
}
