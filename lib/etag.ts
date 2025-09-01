import crypto from "crypto";

export function etagForBuffer(buf: Uint8Array | Buffer): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  // Base64 URL (corto, estable)
  return crypto.createHash("sha256").update(b).digest("base64url");
}

export function cleanIfNoneMatch(value?: string | null): string | null {
  if (!value) return null;
  // quita W/ y comillas
  return value.replace(/^W\//, "").replace(/"/g, "");
}