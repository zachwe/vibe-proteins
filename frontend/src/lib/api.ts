/**
 * API client for VibeProteins backend
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Types matching the API responses
export interface Challenge {
  id: string;
  name: string;
  description: string | null;
  difficulty: number;
  level: number;
  taskType: string;
  targetPdbId: string | null;
  targetStructureUrl: string | null;
  targetSequence: string | null;
  educationalContent: string | null;
  hints: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
}

export interface Job {
  id: string;
  userId: string;
  challengeId: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  creditsUsed: number;
  createdAt: string;
}

export interface Submission {
  id: string;
  userId: string;
  challengeId: string;
  designSequence: string;
  designPdbUrl: string | null;
  score: number | null;
  scoreBreakdown: Record<string, unknown> | null;
  feedback: string | null;
  createdAt: string;
}

// API error type
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Base fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    credentials: "include", // Include cookies for auth
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new ApiError(response.status, error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Challenge API
export const challengesApi = {
  list: () => apiFetch<{ challenges: Challenge[] }>("/api/challenges"),

  get: (id: string) => apiFetch<{ challenge: Challenge }>(`/api/challenges/${id}`),
};

// User API
export const usersApi = {
  me: () => apiFetch<{ user: User }>("/api/users/me"),
};

// Jobs API
export const jobsApi = {
  list: () => apiFetch<{ jobs: Job[] }>("/api/jobs"),

  get: (id: string) => apiFetch<{ job: Job }>(`/api/jobs/${id}`),

  create: (data: { challengeId: string; type: string; input?: Record<string, unknown> }) =>
    apiFetch<{ job: Job }>("/api/jobs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  health: () => apiFetch<{ status: string; message: string }>("/api/jobs/health"),
};

// Submissions API
export const submissionsApi = {
  list: () => apiFetch<{ submissions: Submission[] }>("/api/submissions"),

  get: (id: string) => apiFetch<{ submission: Submission }>(`/api/submissions/${id}`),

  create: (data: { challengeId: string; designSequence: string; designPdbUrl?: string }) =>
    apiFetch<{ submission: Submission }>("/api/submissions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
