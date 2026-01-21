/**
 * API client for VibeProteins backend
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Types matching the API responses
export interface ChainAnnotation {
  name: string;
  role: "target" | "context";
  description: string;
}

export interface SuggestedHotspot {
  residues: string[];
  label: string;
  description: string;
}

export interface Challenge {
  id: string;
  name: string;
  description: string | null;
  mission: string | null;
  level: number;
  taskType: string;
  targetPdbId: string | null;
  targetUniprotId: string | null;
  targetStructureUrl: string | null;
  targetSequence: string | null;
  targetChainId: string | null;
  pdbStartResidue: number | null;
  pdbDescription: string | null;
  chainAnnotations: string | null; // JSON string of Record<string, ChainAnnotation>
  suggestedHotspots: string | null; // JSON string of SuggestedHotspot[]
  structureNote: string | null; // Note explaining PDB-specific details
  educationalContent: string | null;
  hints: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  balanceUsdCents: number;
  balanceFormatted: string;
}

export interface ActiveTeam {
  id: string;
  name: string;
  slug: string;
  balanceUsdCents: number;
  balanceFormatted: string;
  role: "owner" | "admin" | "member";
}

export interface EffectiveBalance {
  type: "personal" | "team";
  balanceUsdCents: number;
  balanceFormatted: string;
  teamName?: string;
}

export interface UserResponse {
  user: User;
  activeTeam: ActiveTeam | null;
  effectiveBalance: EffectiveBalance;
}

export interface JobProgressEvent {
  stage: string;
  message: string;
  timestamp: number;
}

export interface Job {
  id: string;
  userId: string;
  challengeId: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  modalCallId: string | null;
  progress: JobProgressEvent[] | null;
  error: string | null;
  gpuType: string | null;
  executionSeconds: number | null;
  costUsdCents: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Submission {
  id: string;
  userId: string;
  challengeId: string;
  designSequence: string;
  designPdbUrl: string | null;
  designStructureUrl: string | null;
  designStructureSignedUrl: string | null; // Signed URL for browser access
  status: "pending" | "running" | "completed" | "failed";
  error: string | null;
  // Score fields
  compositeScore: number | null;
  ipSaeScore: number | null;
  plddt: number | null;
  ptm: number | null;
  interfaceArea: number | null;
  shapeComplementarity: number | null;
  createdAt: string;
}

export interface DepositPreset {
  id: string;
  amountCents: number;
  label: string;
  isActive: boolean;
  sortOrder: number;
}

export interface GpuPricing {
  id: string;
  name: string;
  modalRatePerSec: number;
  markupPercent: number;
  ourRatePerSec: number;
  ourRatePerMin: number;
}

export interface Transaction {
  id: string;
  userId: string;
  amountCents: number;
  type: "deposit" | "job_usage" | "refund";
  jobId: string | null;
  stripeSessionId: string | null;
  description: string | null;
  balanceAfterCents: number | null;
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

  leaderboard: (
    id: string,
    options?: { sortBy?: LeaderboardSortBy; limit?: number; offset?: number }
  ) => {
    const params = new URLSearchParams();
    if (options?.sortBy) params.set("sortBy", options.sortBy);
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());
    const queryString = params.toString();
    return apiFetch<LeaderboardResponse>(
      `/api/challenges/${id}/leaderboard${queryString ? `?${queryString}` : ""}`
    );
  },
};

// User API
export const usersApi = {
  me: () => apiFetch<UserResponse>("/api/users/me"),
  deleteAccount: () => apiFetch<{ success: boolean }>("/api/users/me", { method: "DELETE" }),
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

  create: (data: { challengeId: string; jobId?: string; designSequence: string; designStructureUrl?: string }) =>
    apiFetch<{ submission: Submission }>("/api/submissions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createCustom: (data: { challengeId: string; designSequence: string }) =>
    apiFetch<{ submission: Submission & { jobId: string } }>("/api/submissions/custom", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  retry: (id: string) =>
    apiFetch<{ success: boolean; status: string }>(`/api/submissions/${id}/retry`, {
      method: "POST",
    }),
};

// Billing API
export const billingApi = {
  getPresets: () => apiFetch<{ presets: DepositPreset[] }>("/api/billing/presets"),

  getPricing: () => apiFetch<{ pricing: GpuPricing[] }>("/api/billing/pricing"),

  createDeposit: (amountCents: number) =>
    apiFetch<{ url: string }>("/api/billing/deposit", {
      method: "POST",
      body: JSON.stringify({ amountCents }),
    }),

  getTransactions: () =>
    apiFetch<{ transactions: Transaction[] }>("/api/billing/transactions"),

  getPortalUrl: () => apiFetch<{ url: string }>("/api/billing/portal"),
};

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  id: string;
  compositeScore: number | null;
  ipSaeScore: number | null;
  plddt: number | null;
  ptm: number | null;
  interfaceArea: number | null;
  shapeComplementarity: number | null;
  createdAt: string;
  userId: string;
  userName: string;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  totalCount: number;
  sortBy: string;
  limit: number;
  offset: number;
}

export type LeaderboardSortBy =
  | "compositeScore"
  | "plddt"
  | "ptm"
  | "ipSaeScore"
  | "interfaceArea"
  | "shapeComplementarity";

// Reference binder types
export interface ReferenceBinder {
  id: string;
  challengeId: string;
  name: string;
  slug: string;
  binderType: "antibody" | "nanobody" | "fusion_protein" | "designed" | "natural";
  pdbId: string | null;
  pdbUrl: string | null;
  binderChainId: string | null;
  binderSequence: string | null;
  complexStructureUrl: string | null;
  compositeScore: number | null;
  ipSaeScore: number | null;
  plddt: number | null;
  ptm: number | null;
  interfaceArea: number | null;
  shapeComplementarity: number | null;
  helpArticleSlug: string | null;
  shortDescription: string | null;
  scoringNote: string | null;
  discoveryYear: number | null;
  approvalStatus: "fda_approved" | "clinical_trial" | "research_tool" | "de_novo_designed" | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface HelpArticle {
  slug: string;
  title: string;
  content: string;
  category: "reference-binder" | "concept" | "tutorial";
  relatedChallenges: string | null;
  createdAt: string;
  updatedAt: string;
}

// Reference binders API
export const referenceBindersApi = {
  list: () => apiFetch<{ referenceBinders: ReferenceBinder[] }>("/api/reference-binders"),

  get: (id: string) =>
    apiFetch<{ referenceBinder: ReferenceBinder; article: HelpArticle | null }>(
      `/api/reference-binders/${id}`
    ),

  forChallenge: (challengeId: string) =>
    apiFetch<{ referenceBinders: ReferenceBinder[] }>(
      `/api/challenges/${challengeId}/reference-binders`
    ),
};

// Help articles API
export const helpApi = {
  list: (category?: string) => {
    const params = category ? `?category=${category}` : "";
    return apiFetch<{ articles: HelpArticle[] }>(`/api/help${params}`);
  },

  get: (slug: string) => apiFetch<{ article: HelpArticle }>(`/api/help/${slug}`),
};

// Suggestion types
export interface Suggestion {
  text: string;
  type: "improve" | "verify" | "success" | "learn";
}

export interface SuggestionRequest {
  jobType: string;
  scores: Record<string, number | undefined>;
  hasHotspots: boolean;
  challengeName?: string;
  challengeTaskType?: string;
}

// Suggestions API
export const suggestionsApi = {
  getSuggestions: (data: SuggestionRequest) =>
    apiFetch<{ suggestions: Suggestion[] }>("/api/suggestions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
