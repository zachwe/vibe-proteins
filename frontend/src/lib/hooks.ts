/**
 * React Query hooks for API data fetching
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { challengesApi, usersApi, jobsApi, submissionsApi } from "./api";

// Query keys for cache management
export const queryKeys = {
  challenges: ["challenges"] as const,
  challenge: (id: string) => ["challenges", id] as const,
  user: ["user"] as const,
  jobs: ["jobs"] as const,
  job: (id: string) => ["jobs", id] as const,
  submissions: ["submissions"] as const,
  submission: (id: string) => ["submissions", id] as const,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.user }); // Credits changed
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
