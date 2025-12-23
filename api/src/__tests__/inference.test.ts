import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ModalProvider } from "../inference/modal";

describe("ModalProvider", () => {
  let provider: ModalProvider;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create a fresh provider with a test endpoint
    provider = new ModalProvider("https://test-modal-endpoint.modal.run");

    // Mock global fetch
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("healthCheck", () => {
    it("should return ok when Modal responds successfully", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ok", message: "Modal is healthy" }),
      });

      const result = await provider.healthCheck();

      expect(result).toEqual({
        status: "ok",
        message: "Modal is healthy",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://test-modal-endpoint.modal.run",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_type: "health", params: {} }),
        })
      );
    });

    it("should return error when Modal returns non-ok status", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await provider.healthCheck();

      expect(result.status).toBe("error");
      expect(result.message).toBe("Modal returned 500");
    });

    it("should return error when fetch throws", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.healthCheck();

      expect(result.status).toBe("error");
      expect(result.message).toBe("Network error");
    });
  });

  describe("submitJob", () => {
    it("should submit RFDiffusion3 job with transformed params", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "completed",
            message: "Job completed",
          }),
      });

      const result = await provider.submitJob("rfdiffusion3", {
        targetPdb: "some-pdb-data",
        hotspotResidues: ["A:123", "A:124"],
        numDesigns: 5,
      });

      expect(result.status).toBe("completed");
      expect(result.jobId).toBeDefined();
      expect(result.result?.output).toEqual(
        expect.objectContaining({ message: "Job completed" })
      );

      // Verify the params were transformed correctly
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.job_type).toBe("rfdiffusion3");
      expect(callBody.params).toMatchObject({
        target_pdb: "some-pdb-data",
        hotspot_residues: ["A:123", "A:124"],
        num_designs: 5,
        binder_length: 85,
        sequences_per_backbone: 4,
      });
    });

    it("should submit boltz2 job with transformed params", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "completed" }),
      });

      await provider.submitJob("boltz2", {
        numSamples: 10,
        binderSequence: "AAA",
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.job_type).toBe("boltz2");
      expect(callBody.params).toMatchObject({
        num_samples: 10,
        binder_sequence: "AAA",
      });
    });

    it("should submit proteinmpnn job with transformed params", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "completed" }),
      });

      await provider.submitJob("proteinmpnn", {
        backbonePdb: "backbone-data",
        sequencesPerDesign: 2,
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.job_type).toBe("proteinmpnn");
      expect(callBody.params).toMatchObject({
        backbone_pdb: "backbone-data",
        num_sequences: 2,
      });
    });

    it("should submit predict job with transformed params", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "completed" }),
      });

      await provider.submitJob("predict", {
        sequence: "MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH",
        targetSequence: "MNIFEMLRIDEGLRLKIYKDTEGYYTIGIGHLLTKSPSLNAAKSELDKAIGRNCNGVITKDEAEKLFNQDVDAAVRGILRNAKLKPVYDSLDAVRRCALINMVFQMGETGVAGFTNSLRMLQQKRWDEAAVNLAKSRWYNQTPNRAKRVITTFRTGTWDAYKNL",
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.job_type).toBe("predict");
      expect(callBody.params).toMatchObject({
        sequence: "MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH",
        target_sequence: "MNIFEMLRIDEGLRLKIYKDTEGYYTIGIGHLLTKSPSLNAAKSELDKAIGRNCNGVITKDEAEKLFNQDVDAAVRGILRNAKLKPVYDSLDAVRRCALINMVFQMGETGVAGFTNSLRMLQQKRWDEAAVNLAKSRWYNQTPNRAKRVITTFRTGTWDAYKNL",
      });
    });

    it("should submit score job with transformed params", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "completed" }),
      });

      await provider.submitJob("score", {
        designPdb: "design-pdb-data",
        targetPdb: "target-pdb-data",
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.job_type).toBe("score");
      expect(callBody.params).toMatchObject({
        design_pdb: "design-pdb-data",
        target_pdb: "target-pdb-data",
      });
    });

    it("should return failed status when Modal request fails", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal server error"),
      });

      const result = await provider.submitJob("rfdiffusion3", {
        targetPdb: "test",
      });

      expect(result.status).toBe("failed");
    });

    it("should return failed status when fetch throws", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.submitJob("rfdiffusion3", {
        targetPdb: "test",
      });

      expect(result.status).toBe("failed");
    });
  });

  describe("getJobStatus", () => {
    it("should return completed status (placeholder implementation)", async () => {
      const result = await provider.getJobStatus("some-call-id");

      expect(result.status).toBe("completed");
      expect(result.jobId).toBe("some-call-id");
    });
  });
});
