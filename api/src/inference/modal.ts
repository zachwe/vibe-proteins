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

      // For now, jobs complete synchronously (placeholder functions are fast)
      // TODO: Implement async job handling with Modal's spawn() API
      return {
        jobId,
        status: result.status === "not_implemented" ? "completed" : "completed",
        callId: jobId, // In async mode, this would be the Modal call ID
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
      case "bindcraft":
        return {
          target_pdb: input.targetPdb,
          hotspot_residues: input.hotspotResidues || [],
          num_designs: input.numDesigns || 10,
        };

      case "boltzgen":
        return {
          prompt: input.prompt || "",
          num_samples: input.numSamples || 5,
        };

      case "predict":
        return {
          sequence: input.sequence || "",
          target_sequence: input.targetSequence,
        };

      case "score":
        return {
          design_pdb: input.designPdb || "",
          target_pdb: input.targetPdb || "",
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
