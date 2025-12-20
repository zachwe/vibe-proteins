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

// Modal endpoint URL
const MODAL_ENDPOINT =
  process.env.MODAL_ENDPOINT ||
  "https://zach-b-ocean--vibeproteins-submit-job.modal.run";

export class ModalProvider implements InferenceProvider {
  private endpoint: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || MODAL_ENDPOINT;
  }

  async submitJob(type: JobType, input: JobInput): Promise<SubmitJobResponse> {
    const jobId = randomUUID();

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_type: type,
          params: this.transformInput(type, input),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Modal request failed: ${response.status} - ${error}`);
      }

      const result = await response.json();
      const status: JobStatus =
        result.status && ["pending", "running", "failed", "completed"].includes(result.status)
          ? result.status
          : "completed";
      const completedAt = new Date();

      return {
        jobId,
        status,
        callId: jobId, // In async mode, this would be the Modal call ID
        result: {
          status,
          output: result,
          startedAt: completedAt,
          completedAt: status === "completed" ? completedAt : undefined,
        },
      };
    } catch (error) {
      console.error("Modal job submission failed:", error);
      return {
        jobId,
        status: "failed",
      };
    }
  }

  async getJobStatus(callId: string): Promise<JobStatusResponse> {
    // TODO: Implement proper async job status polling
    // For now, jobs complete synchronously so this just returns completed
    return {
      jobId: callId,
      status: "completed",
      result: {
        status: "completed",
        output: { message: "Job completed (placeholder)" },
      },
    };
  }

  async healthCheck(): Promise<{ status: "ok" | "error"; message: string }> {
    try {
      const response = await fetch(this.endpoint, {
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
        return {
          target_pdb: input.targetPdb || input.targetStructureUrl,
          target_structure_url: input.targetStructureUrl,
          target_sequence: input.targetSequence,
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
          prompt: input.prompt || "",
          num_samples: input.numSamples ?? 1,
          boltz_mode: input.boltzMode || "complex",
          job_id: input.jobId,
        };

      case "proteinmpnn":
        return {
          backbone_pdb: input.backbonePdb || input.targetPdb,
          num_sequences: input.sequencesPerDesign ?? input.numSamples ?? 4,
          binder_sequence: input.binderSequence,
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
          job_id: input.jobId,
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
