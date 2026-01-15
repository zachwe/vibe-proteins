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
            call_id: "test-call-id-123",
          }),
      });

      const result = await provider.submitJob("rfdiffusion3", {
        targetPdb: "some-pdb-data",
        hotspotResidues: ["A:123", "A:124"],
        numDesigns: 5,
      });

      // Async mode returns pending status with callId
      expect(result.status).toBe("pending");
      expect(result.jobId).toBeDefined();
      expect(result.callId).toBe("test-call-id-123");

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

    it("should submit boltzgen job with transformed params", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ call_id: "boltzgen-call-123" }),
      });

      await provider.submitJob("boltzgen", {
        targetStructureUrl: "https://example.com/target.cif",
        targetChainIds: ["A", "B"],
        binderLengthRange: "80..120",
        bindingResidues: ["10..15", "25"],
        boltzgenScaffoldSet: "nanobody",
        boltzgenScaffoldPaths: ["/assets/boltzgen/nanobody_scaffolds/7eow.yaml"],
        boltzgenProtocol: "protein-anything",
        numDesigns: 100,
        boltzgenBudget: 10,
        boltzgenAlpha: 0.01,
        diffusionBatchSize: 8,
        stepScale: 1.5,
        noiseScale: 0.5,
        inverseFoldNumSequences: 2,
        inverseFoldAvoid: "C",
        skipInverseFolding: false,
        filterBiased: true,
        refoldingRmsdThreshold: 2.0,
        additionalFilters: ["plddt > 0.7"],
        metricsOverride: "custom_metric",
        boltzgenDevices: 1,
        boltzgenSteps: ["design", "folding"],
        boltzgenReuse: true,
        jobId: "test-job-id",
        challengeId: "challenge-123",
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.job_type).toBe("boltzgen");
      expect(callBody.params).toMatchObject({
        target_pdb: "https://example.com/target.cif",
        target_structure_url: "https://example.com/target.cif",
        target_chain_ids: ["A", "B"],
        binder_length: "80..120",
        binding_residues: ["10..15", "25"],
        scaffold_set: "nanobody",
        scaffold_paths: ["/assets/boltzgen/nanobody_scaffolds/7eow.yaml"],
        protocol: "protein-anything",
        num_designs: 100,
        budget: 10,
        alpha: 0.01,
        diffusion_batch_size: 8,
        step_scale: 1.5,
        noise_scale: 0.5,
        inverse_fold_num_sequences: 2,
        inverse_fold_avoid: "C",
        skip_inverse_folding: false,
        filter_biased: true,
        refolding_rmsd_threshold: 2.0,
        additional_filters: ["plddt > 0.7"],
        metrics_override: "custom_metric",
        devices: 1,
        steps: ["design", "folding"],
        reuse: true,
        job_id: "test-job-id",
        challenge_id: "challenge-123",
      });
    });

    it("should submit boltzgen job with default values", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ call_id: "boltzgen-call-456" }),
      });

      await provider.submitJob("boltzgen", {
        targetStructureUrl: "https://example.com/target.pdb",
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.job_type).toBe("boltzgen");
      expect(callBody.params).toMatchObject({
        target_pdb: "https://example.com/target.pdb",
        target_structure_url: "https://example.com/target.pdb",
        binder_length: "80..120",
        protocol: "protein-anything",
        num_designs: 100,
        budget: 10,
        alpha: 0.01,
        inverse_fold_num_sequences: 1,
        skip_inverse_folding: false,
        filter_biased: true,
        reuse: false,
      });
    });

    it("should handle boltzgen with hotspotResidues as binding_residues fallback", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ call_id: "boltzgen-call-789" }),
      });

      await provider.submitJob("boltzgen", {
        targetStructureUrl: "https://example.com/target.pdb",
        hotspotResidues: ["A:100", "A:105"],
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.params.binding_residues).toEqual(["A:100", "A:105"]);
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
    it("should return completed status when job is done", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "completed",
            output: { pdb_url: "https://example.com/result.pdb" },
          }),
      });

      const result = await provider.getJobStatus("some-call-id");

      expect(result.status).toBe("completed");
      expect(result.jobId).toBe("some-call-id");
      expect(result.result?.output).toEqual({ pdb_url: "https://example.com/result.pdb" });
    });

    it("should return running status when fetch fails", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.getJobStatus("some-call-id");

      expect(result.status).toBe("running");
      expect(result.jobId).toBe("some-call-id");
    });
  });
});
