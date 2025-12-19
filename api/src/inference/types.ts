/**
 * Inference job types and interfaces
 */

export type JobType = "rfdiffusion" | "boltz2" | "proteinmpnn" | "predict" | "score";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobInput {
  // RFdiffusion binder pipeline
  targetPdb?: string;
  targetStructureUrl?: string | null;
  targetSequence?: string | null;
  hotspotResidues?: string[];
  numDesigns?: number;
  binderLength?: number;
  diffusionSteps?: number;
  sequencesPerBackbone?: number;
  boltzSamples?: number;
  binderSeeds?: number;

  // Boltz-2 sanity check
  prompt?: string;
  numSamples?: number;
  binderSequence?: string;
  binderPdb?: string;
  boltzMode?: "complex" | "binder";

  // ProteinMPNN direct design
  backbonePdb?: string;
  sequencesPerDesign?: number;

  // Structure prediction
  sequence?: string;

  // Scoring
  designPdb?: string;
  targetStructureKey?: string;

  // Meta
  jobId?: string;
  challengeId?: string;
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
  result?: JobResult; // For synchronous jobs that complete immediately
}

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  result?: JobResult;
}
