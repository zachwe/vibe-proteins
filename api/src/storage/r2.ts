/**
 * Cloudflare R2 / S3 helper utilities
 *
 * We can't rely on the AWS SDK in this environment, so we construct
 * Signature Version 4 requests manually using the Node crypto module.
 * This keeps the helpers lightweight and totally dependency free.
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";

const REGION = "auto";
const SERVICE = "s3";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string;
}

interface SignedRequestParams {
  method: "GET" | "PUT" | "DELETE";
  key: string;
  body?: Uint8Array;
  contentType?: string;
  extraHeaders?: Record<string, string>;
  cacheControl?: string;
  now?: Date;
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

export interface UploadParams {
  key: string;
  body: string | Uint8Array | Buffer;
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
}

function getConfig(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || process.env.R2_CDN_BASE_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Missing R2 configuration. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.");
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: publicBaseUrl?.replace(/\/+$/, ""),
  };
}

function hashHex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Uint8Array | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function getSignatureKey(secret: string, dateStamp: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

function encodeKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildSignedRequest(params: SignedRequestParams): SignedRequest {
  const config = getConfig();
  const body = params.body ?? new Uint8Array();
  const contentType = params.contentType || (params.method === "PUT" ? "application/octet-stream" : undefined);
  const encodedKey = encodeKey(params.key);
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${config.bucket}/${encodedKey}`;
  const now = params.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hashHex(body);

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  if (contentType) {
    headers["content-type"] = contentType;
  }

  if (params.cacheControl) {
    headers["cache-control"] = params.cacheControl;
  }

  if (params.extraHeaders) {
    Object.entries(params.extraHeaders).forEach(([key, value]) => {
      headers[key.toLowerCase()] = value;
    });
  }

  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value.trim()}`)
    .join("\n");

  const signedHeaders = Object.keys(headers)
    .map((key) => key.toLowerCase())
    .sort()
    .join(";");

  const canonicalRequest = [
    params.method,
    `/${config.bucket}/${encodedKey}`,
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashHex(Buffer.from(canonicalRequest)),
  ].join("\n");

  const signatureKey = getSignatureKey(config.secretAccessKey, dateStamp);
  const signature = hmac(signatureKey, stringToSign).toString("hex");

  const authorization = [
    "AWS4-HMAC-SHA256 Credential=",
    `${config.accessKeyId}/${credentialScope}`,
    `, SignedHeaders=${signedHeaders}`,
    `, Signature=${signature}`,
  ].join("");

  return {
    url,
    headers: {
      ...Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key, value])
      ),
      Authorization: authorization,
    },
  };
}

function toUint8Array(data: string | Uint8Array | Buffer): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (typeof data === "string") {
    return Buffer.from(data);
  }
  return new Uint8Array(data);
}

export function getPublicUrl(key: string): string {
  const config = getConfig();
  const safeKey = key.replace(/^\/+/, "");
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl}/${safeKey}`;
  }
  return `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${encodeKey(safeKey)}`;
}

export async function uploadObject(params: UploadParams): Promise<UploadResult> {
  const body = toUint8Array(params.body);
  const request = buildSignedRequest({
    method: "PUT",
    key: params.key,
    body,
    contentType: params.contentType,
    extraHeaders: params.metadata,
  });

  const response = await fetch(request.url, {
    method: "PUT",
    headers: request.headers,
    body: Buffer.from(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 upload failed (${response.status}): ${text}`);
  }

  return {
    key: params.key,
    url: getPublicUrl(params.key),
  };
}

export async function downloadObject(key: string): Promise<Uint8Array> {
  const request = buildSignedRequest({
    method: "GET",
    key,
  });

  const response = await fetch(request.url, {
    method: "GET",
    headers: request.headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 download failed (${response.status}): ${text}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function deleteObject(key: string): Promise<void> {
  const request = buildSignedRequest({
    method: "DELETE",
    key,
  });

  const response = await fetch(request.url, {
    method: "DELETE",
    headers: request.headers,
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`R2 delete failed (${response.status}): ${text}`);
  }
}

/**
 * Basic compare helper for presigned URL verification in tests.
 */
export function signaturesMatch(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
