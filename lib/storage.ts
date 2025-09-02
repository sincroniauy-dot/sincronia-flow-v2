import { bucket } from "./firebaseAdmin";
import type { GetSignedUrlConfig } from "@google-cloud/storage";

export async function uploadBufferToStorage(
  path: string,
  buffer: Uint8Array | Buffer,
  contentType: string,
  metadata: Record<string, string | number | boolean> = {}
) {
  const file = bucket.file(path);
  await file.save(Buffer.from(buffer), {
    contentType,
    resumable: false,
    metadata: { metadata },
  });
  return file;
}

export async function getV4ReadSignedUrl(path: string, minutes: number): Promise<string> {
  const file = bucket.file(path);
  const expires = Date.now() + minutes * 60 * 1000;
  const [url] = await file.getSignedUrl({
    action: "read",
    version: "v4",
    expires,
  } as GetSignedUrlConfig);
  return url;
}