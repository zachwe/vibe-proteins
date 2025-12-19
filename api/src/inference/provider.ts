/**
 * Abstract inference provider interface
 *
 * This allows swapping between different inference backends
 * (Modal, local, mock for testing, etc.)
 */

import type {
  JobType,
  JobInput,
  SubmitJobResponse,
  JobStatusResponse,
} from "./types";

export interface InferenceProvider {
  /**
   * Submit a job for processing
   */
  submitJob(
    type: JobType,
    input: JobInput
  ): Promise<SubmitJobResponse>;

  /**
   * Get the status of a running job
   */
  getJobStatus(callId: string): Promise<JobStatusResponse>;

  /**
   * Check if the provider is healthy/available
   */
  healthCheck(): Promise<{ status: "ok" | "error"; message: string }>;
}
