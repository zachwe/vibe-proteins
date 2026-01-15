/**
 * Inference job types and interfaces
 */

export type JobType =
  | "rfdiffusion3"
  | "boltz2"
  | "boltzgen"
  | "proteinmpnn"
  | "predict"
  | "score";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobInputBase {
  // Meta
  jobId?: string;
  challengeId?: string;
}

// RFDiffusion3 binder pipeline
export interface RfDiffusion3JobInput extends JobInputBase {
  targetPdb?: string;
  targetStructureUrl?: string | null;
  targetSequence?: string | null;
  targetChainId?: string;
  targetChainIds?: string[];
  hotspotResidues?: string[];
  numDesigns?: number;
  binderLength?: number;
  diffusionSteps?: number;
  sequencesPerBackbone?: number;
  boltzSamples?: number;
  binderSeeds?: number;
}

// Boltz-2 folding
export interface Boltz2JobInput extends JobInputBase {
  targetPdb?: string;
  targetStructureUrl?: string | null;
  binderSequence?: string;
  sequence?: string;
  binderPdb?: string;
  designPdb?: string;
  numSamples?: number;
  boltzMode?: "complex" | "binder";
  prompt?: string;
}

// ProteinMPNN direct design
export interface ProteinMpnnJobInput extends JobInputBase {
  backbonePdb?: string;
  targetPdb?: string;
  sequencesPerDesign?: number;
  numSamples?: number;
}

// Structure prediction
export interface PredictJobInput extends JobInputBase {
  sequence?: string;
  targetSequence?: string | null;
}

// Scoring
export interface ScoreJobInput extends JobInputBase {
  designPdb?: string;
  targetPdb?: string;
  targetStructureUrl?: string | null;
  targetStructureKey?: string;
  binderSequence?: string;
  targetChainId?: string;
  targetChainIds?: string[];
}

// BoltzGen
export interface BoltzgenJobInput extends JobInputBase {
  targetPdb?: string;
  targetStructureUrl?: string | null;
  targetChainIds?: string[];
  binderLengthRange?: string;
  binderLength?: number;
  bindingResidues?: string[];
  hotspotResidues?: string[];
  boltzgenScaffoldSet?: string;
  boltzgenScaffoldPaths?: string[];
  boltzgenProtocol?: string;
  numDesigns?: number;
  diffusionBatchSize?: number;
  stepScale?: number;
  noiseScale?: number;
  inverseFoldNumSequences?: number;
  inverseFoldAvoid?: string;
  skipInverseFolding?: boolean;
  boltzgenBudget?: number;
  boltzgenAlpha?: number;
  filterBiased?: boolean;
  refoldingRmsdThreshold?: number;
  additionalFilters?: string[];
  metricsOverride?: string;
  boltzgenDevices?: number;
  boltzgenSteps?: string[];
  boltzgenReuse?: boolean;
}

export type JobInputByType = {
  rfdiffusion3: RfDiffusion3JobInput;
  boltz2: Boltz2JobInput;
  proteinmpnn: ProteinMpnnJobInput;
  predict: PredictJobInput;
  score: ScoreJobInput;
  boltzgen: BoltzgenJobInput;
};

export type JobInput = JobInputByType[JobType];

export interface JobResult {
  status: JobStatus;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export type SubmitJobRequest = {
  [K in JobType]: {
    type: K;
    challengeId: string;
    input: JobInputByType[K];
  };
}[JobType];

export interface SubmitJobResponse {
  jobId: string;
  status: JobStatus;
  callId?: string; // Modal function call ID for polling
  result?: JobResult; // For synchronous jobs that complete immediately
}

export interface ProgressEvent {
  stage: string;
  message: string;
  timestamp: number;
}

export interface JobUsage {
  gpu_type?: string;
  execution_seconds?: number;
}

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  result?: JobResult;
  progress?: ProgressEvent[];
  usage?: JobUsage;
}
