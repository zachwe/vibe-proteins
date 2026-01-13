/**
 * Modal inference provider
 *
 * Calls Modal functions via HTTP endpoints
 */

import type { InferenceProvider } from "./provider";
import type {
  JobType,
  JobInput,
  RfDiffusion3JobInput,
  Boltz2JobInput,
  ProteinMpnnJobInput,
  PredictJobInput,
  ScoreJobInput,
  BoltzgenJobInput,
  SubmitJobResponse,
  JobStatusResponse,
  JobStatus,
} from "./types";
import { randomUUID } from "crypto";

// Modal endpoint URLs
const MODAL_SUBMIT_ENDPOINT =
  process.env.MODAL_SUBMIT_ENDPOINT ||
  "https://zach-b-ocean--vibeproteins-submit-job.modal.run";

const MODAL_STATUS_ENDPOINT =
  process.env.MODAL_STATUS_ENDPOINT ||
  "https://zach-b-ocean--vibeproteins-get-job-status-endpoint.modal.run";

export class ModalProvider implements InferenceProvider {
  private submitEndpoint: string;
  private statusEndpoint: string;

  constructor(submitEndpoint?: string, statusEndpoint?: string) {
    this.submitEndpoint = submitEndpoint || MODAL_SUBMIT_ENDPOINT;
    this.statusEndpoint = statusEndpoint || MODAL_STATUS_ENDPOINT;
  }

  async submitJob(type: JobType, input: JobInput): Promise<SubmitJobResponse> {
    const jobId = input.jobId || randomUUID();

    try {
      const response = await fetch(this.submitEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_type: type,
          params: this.transformInput(type, input),
          async: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Modal request failed: ${response.status} - ${error}`);
      }

      const result = await response.json();

      // Async mode: Modal returns immediately with call_id
      // We poll get_job_status for progress and completion
      return {
        jobId,
        status: "pending",
        callId: result.call_id,
      };
    } catch (error) {
      console.error("Modal job submission failed:", error);
      return {
        jobId,
        status: "failed",
      };
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    try {
      const response = await fetch(`${this.statusEndpoint}?job_id=${encodeURIComponent(jobId)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return {
          jobId,
          status: "running", // Assume still running if we can't reach Modal
        };
      }

      const result = await response.json();

      if (result.status === "not_found") {
        return {
          jobId,
          status: "pending",
        };
      }

      const status: JobStatus =
        result.status && ["pending", "running", "failed", "completed"].includes(result.status)
          ? result.status
          : "running";

      return {
        jobId,
        status,
        result: status === "completed" || status === "failed" ? {
          status,
          output: result.output,
          error: result.error,
        } : undefined,
        progress: result.progress,
        usage: result.usage,
      };
    } catch (error) {
      console.error("Failed to get job status from Modal:", error);
      return {
        jobId,
        status: "running", // Assume still running on error
      };
    }
  }

  async healthCheck(): Promise<{ status: "ok" | "error"; message: string }> {
    try {
      const response = await fetch(this.submitEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_type: "health",
          params: {},
        }),
      });

      if (!response.ok) {
        return {
          status: "error",
          message: `Modal returned ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        status: result.status === "ok" ? "ok" : "error",
        message: result.message || "Modal is healthy",
      };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Transform API input to Modal function parameters
   */
  private transformInput(
    type: JobType,
    input: JobInput
  ): Record<string, unknown> {
    switch (type) {
      case "rfdiffusion3":
        // Convert targetChainId (singular) to targetChainIds (array) if needed
        const rfd3Input = input as RfDiffusion3JobInput;
        const rfd3ChainIds = rfd3Input.targetChainIds
          || (rfd3Input.targetChainId ? [rfd3Input.targetChainId] : undefined);
        return {
          target_pdb: rfd3Input.targetPdb || rfd3Input.targetStructureUrl,
          target_structure_url: rfd3Input.targetStructureUrl,
          target_sequence: rfd3Input.targetSequence,
          target_chain_ids: rfd3ChainIds,
          hotspot_residues: rfd3Input.hotspotResidues || [],
          num_designs: rfd3Input.numDesigns ?? 2,
          binder_length: rfd3Input.binderLength ?? 85,
          diffusion_steps: rfd3Input.diffusionSteps ?? 30,
          sequences_per_backbone: rfd3Input.sequencesPerBackbone ?? 4,
          boltz_samples: rfd3Input.boltzSamples ?? 1,
          binder_seeds: rfd3Input.binderSeeds ?? rfd3Input.numDesigns ?? 2,
          job_id: rfd3Input.jobId,
          challenge_id: rfd3Input.challengeId,
        };

      case "boltz2":
        const boltz2Input = input as Boltz2JobInput;
        return {
          target_pdb: boltz2Input.targetPdb || boltz2Input.targetStructureUrl,
          binder_sequence: boltz2Input.binderSequence || boltz2Input.sequence,
          binder_pdb: boltz2Input.binderPdb || boltz2Input.designPdb,
          num_samples: boltz2Input.numSamples ?? 1,
          boltz_mode: boltz2Input.boltzMode || "complex",
          job_id: boltz2Input.jobId,
        };

      case "proteinmpnn":
        const proteinMpnnInput = input as ProteinMpnnJobInput;
        return {
          backbone_pdb: proteinMpnnInput.backbonePdb || proteinMpnnInput.targetPdb,
          num_sequences: proteinMpnnInput.sequencesPerDesign ?? proteinMpnnInput.numSamples ?? 4,
          job_id: proteinMpnnInput.jobId,
        };

      case "predict":
        const predictInput = input as PredictJobInput;
        return {
          sequence: predictInput.sequence || "",
          target_sequence: predictInput.targetSequence,
        };

      case "score":
        const scoreInput = input as ScoreJobInput;
        return {
          design_pdb: scoreInput.designPdb || "",
          target_pdb: scoreInput.targetPdb || scoreInput.targetStructureUrl || "",
          binder_sequence: scoreInput.binderSequence,
          target_chain_ids: scoreInput.targetChainIds
            || (scoreInput.targetChainId ? [scoreInput.targetChainId] : undefined),
          job_id: scoreInput.jobId,
        };

      case "boltzgen":
        const boltzgenInput = input as BoltzgenJobInput;
        return {
          target_pdb: boltzgenInput.targetPdb || boltzgenInput.targetStructureUrl,
          target_structure_url: boltzgenInput.targetStructureUrl,
          target_chain_ids: boltzgenInput.targetChainIds,
          binder_length: boltzgenInput.binderLengthRange || boltzgenInput.binderLength || "80..120",
          binding_residues: boltzgenInput.bindingResidues || boltzgenInput.hotspotResidues,
          protocol: boltzgenInput.boltzgenProtocol || "protein-anything",
          num_designs: boltzgenInput.numDesigns ?? 100,
          diffusion_batch_size: boltzgenInput.diffusionBatchSize,
          step_scale: boltzgenInput.stepScale,
          noise_scale: boltzgenInput.noiseScale,
          inverse_fold_num_sequences: boltzgenInput.inverseFoldNumSequences ?? 1,
          inverse_fold_avoid: boltzgenInput.inverseFoldAvoid,
          skip_inverse_folding: boltzgenInput.skipInverseFolding ?? false,
          budget: boltzgenInput.boltzgenBudget ?? 10,
          alpha: boltzgenInput.boltzgenAlpha ?? 0.01,
          filter_biased: boltzgenInput.filterBiased ?? true,
          refolding_rmsd_threshold: boltzgenInput.refoldingRmsdThreshold,
          additional_filters: boltzgenInput.additionalFilters,
          metrics_override: boltzgenInput.metricsOverride,
          devices: boltzgenInput.boltzgenDevices,
          steps: boltzgenInput.boltzgenSteps,
          reuse: boltzgenInput.boltzgenReuse ?? false,
          job_id: boltzgenInput.jobId,
          challenge_id: boltzgenInput.challengeId,
        };

      default:
        return input as Record<string, unknown>;
    }
  }
}

// Singleton instance
let provider: ModalProvider | null = null;

export function getInferenceProvider(): InferenceProvider {
  if (!provider) {
    provider = new ModalProvider();
  }
  return provider;
}
