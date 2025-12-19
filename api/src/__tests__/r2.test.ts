import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TextEncoder } from "node:util";
import { buildSignedRequest, signaturesMatch, getPublicUrl } from "../storage/r2";

const ORIGINAL_ENV = { ...process.env };

describe("R2 storage helpers", () => {
  beforeEach(() => {
    process.env.R2_ACCOUNT_ID = "1234567890abcdef";
    process.env.R2_ACCESS_KEY_ID = "TESTACCESSKEY";
    process.env.R2_SECRET_ACCESS_KEY = "TESTSECRETKEY";
    process.env.R2_BUCKET_NAME = "vibeproteins";
    delete process.env.R2_PUBLIC_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("builds deterministic signatures for uploads", () => {
    const now = new Date("2024-05-01T12:00:00Z");
    const request = buildSignedRequest({
      method: "PUT",
      key: "designs/sample.pdb",
      body: new TextEncoder().encode("HELLO"),
      contentType: "text/plain",
      now,
    });

    expect(request.url).toBe(
      "https://1234567890abcdef.r2.cloudflarestorage.com/vibeproteins/designs/sample.pdb"
    );
    expect(Object.keys(request.headers).some((key) => key.toLowerCase() === "authorization")).toBe(true);
    expect(request.headers).toHaveProperty("x-amz-date", "20240501T120000Z");
    expect(request.headers).toHaveProperty(
      "x-amz-content-sha256",
      "3733cd977ff8eb18b987357e22ced99f46097f31ecb239e878ae63760e83e4d5"
    );

    const expectedSignature =
      "AWS4-HMAC-SHA256 Credential=TESTACCESSKEY/20240501/auto/s3/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=200aac97553c66f89adcb0f3b483cfdfe36fb668541963c2e6fed71f8b29eee3";

    const authHeader =
      Object.entries(request.headers).find(([key]) => key.toLowerCase() === "authorization")?.[1] ?? "";
    expect(authHeader).not.toBe("");
    expect(signaturesMatch(authHeader, expectedSignature)).toBe(true);
  });

  it("builds read URLs when a public base is provided", () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.vibeproteins.dev";
    const url = getPublicUrl("designs/test.pdb");
    expect(url).toBe("https://cdn.vibeproteins.dev/designs/test.pdb");
  });
});
