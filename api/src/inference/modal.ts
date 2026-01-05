/**
 * Modal inference provider
 *
 * Calls Modal functions via HTTP endpoints
 */

import type { InferenceProvider } from "./provider";
import type {
  JobType,
  JobInput,
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
        const rfd3ChainIds = input.targetChainIds
          || (input.targetChainId ? [input.targetChainId] : undefined);
        return {
          target_pdb: input.targetPdb || input.targetStructureUrl,
          target_structure_url: input.targetStructureUrl,
          target_sequence: input.targetSequence,
          target_chain_ids: rfd3ChainIds,
          hotspot_residues: input.hotspotResidues || [],
          num_designs: input.numDesigns ?? 2,
          binder_length: input.binderLength ?? 85,
          diffusion_steps: input.diffusionSteps ?? 30,
          sequences_per_backbone: input.sequencesPerBackbone ?? 4,
          boltz_samples: input.boltzSamples ?? 1,
          binder_seeds: input.binderSeeds ?? input.numDesigns ?? 2,
          job_id: input.jobId,
          challenge_id: input.challengeId,
        };

      case "boltz2":
        return {
          target_pdb: input.targetPdb || input.targetStructureUrl,
          binder_sequence: input.binderSequence || input.sequence,
          binder_pdb: input.binderPdb || input.designPdb,
          num_samples: input.numSamples ?? 1,
          boltz_mode: input.boltzMode || "complex",
          job_id: input.jobId,
        };

      case "proteinmpnn":
        return {
          backbone_pdb: input.backbonePdb || input.targetPdb,
          num_sequences: input.sequencesPerDesign ?? input.numSamples ?? 4,
          job_id: input.jobId,
        };

      case "predict":
        return {
          sequence: input.sequence || "",
          target_sequence: input.targetSequence,
        };

      case "score":
        return {
          design_pdb: input.designPdb || "",
          target_pdb: input.targetPdb || input.targetStructureUrl || "",
          binder_sequence: input.binderSequence,
          target_chain_ids: input.targetChainIds
            || (input.targetChainId ? [input.targetChainId] : undefined),
          job_id: input.jobId,
        };

      case "boltzgen":
        return {
          target_pdb: input.targetPdb || input.targetStructureUrl,
          target_structure_url: input.targetStructureUrl,
          target_chain_ids: input.targetChainIds,
          binder_length: input.binderLengthRange || input.binderLength || "80..120",
          binding_residues: input.bindingResidues || input.hotspotResidues,
          protocol: input.boltzgenProtocol || "protein-anything",
          num_designs: input.numDesigns ?? 100,
          diffusion_batch_size: input.diffusionBatchSize,
          step_scale: input.stepScale,
          noise_scale: input.noiseScale,
          inverse_fold_num_sequences: input.inverseFoldNumSequences ?? 1,
          inverse_fold_avoid: input.inverseFoldAvoid,
          skip_inverse_folding: input.skipInverseFolding ?? false,
          budget: input.boltzgenBudget ?? 10,
          alpha: input.boltzgenAlpha ?? 0.01,
          filter_biased: input.filterBiased ?? true,
          refolding_rmsd_threshold: input.refoldingRmsdThreshold,
          additional_filters: input.additionalFilters,
          metrics_override: input.metricsOverride,
          devices: input.boltzgenDevices,
          steps: input.boltzgenSteps,
          reuse: input.boltzgenReuse ?? false,
          job_id: input.jobId,
          challenge_id: input.challengeId,
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
