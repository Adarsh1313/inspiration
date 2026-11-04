import { createHash } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** The private "media" bucket. Object names are content hashes, so they never change meaning. */
export interface MediaStore {
  put(prefix: string, bytes: Uint8Array, ext: string, contentType: string): Promise<string>;
  get(path: string): Promise<Uint8Array>;
}

export function hashedName(prefix: string, bytes: Uint8Array, ext: string): string {
  return `${prefix}/${createHash("sha256").update(bytes).digest("hex").slice(0, 24)}.${ext.replace(/^\./, "")}`;
}

/**
 * Supabase Storage through its S3-compatible endpoint. The S3 access key only reaches Storage,
 * so a leaked laptop key cannot touch the database (that is what the hub_worker role is for).
 * Dashboard → Storage → S3 Connection → New access key.
 */
export class S3MediaStore implements MediaStore {
  private readonly s3: S3Client;
  constructor(
    endpoint: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    private readonly bucket = "media",
  ) {
    this.s3 = new S3Client({ endpoint, region, credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true });
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): S3MediaStore | null {
    const { HUB_S3_ENDPOINT: e, HUB_S3_REGION: r, HUB_S3_ACCESS_KEY_ID: k, HUB_S3_SECRET_ACCESS_KEY: s } = env;
    return e && r && k && s ? new S3MediaStore(e, r, k, s) : null;
  }

  async put(prefix: string, bytes: Uint8Array, ext: string, contentType: string): Promise<string> {
    const path = hashedName(prefix, bytes, ext);
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: path, Body: bytes, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
    return path;
  }

  async get(path: string): Promise<Uint8Array> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: path }));
    return await res.Body!.transformToByteArray();
  }
}

export class MemoryMediaStore implements MediaStore {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  async put(prefix: string, bytes: Uint8Array, ext: string, contentType: string): Promise<string> {
    const path = hashedName(prefix, bytes, ext);
    this.objects.set(path, { bytes, contentType });
    return path;
  }
  async get(path: string): Promise<Uint8Array> {
    const o = this.objects.get(path);
    if (!o) throw new Error(`No object ${path}`);
    return o.bytes;
  }
}
