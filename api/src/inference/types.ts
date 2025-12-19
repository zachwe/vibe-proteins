/**
 * Inference job types and interfaces
 */

export type JobType = "bindcraft" | "boltzgen" | "predict" | "score";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobInput {
  // BindCraft
  targetPdb?: string;
  hotspotResidues?: string[];
  numDesigns?: number;

  // BoltzGen
  prompt?: string;
  numSamples?: number;

  // Structure prediction
  sequence?: string;
  targetSequence?: string;

  // Scoring
  designPdb?: string;
}

export interface JobResult {
  status: JobStatus;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface SubmitJobRequest {
  type: JobType;
  challengeId: string;
  input: JobInput;
}

export interface SubmitJobResponse {
  jobId: string;
  status: JobStatus;
  callId?: string; // Modal function call ID for polling
}

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  result?: JobResult;
}
