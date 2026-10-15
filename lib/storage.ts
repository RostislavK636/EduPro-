import { getRuntime, config } from "./runtime";
export interface StorageProvider {
  put(key: string, data: Uint8Array, mime: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
}
export class LocalStorageProvider implements StorageProvider {
  private async path(key: string) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw Error("Invalid storage key");
    const { resolve } = await import("node:path");
    return resolve(config("STORAGE_DIRECTORY", "./private-storage"), key);
  }
  async put(key: string, data: Uint8Array) {
    const fs = await import("node:fs/promises");
    await fs.mkdir(config("STORAGE_DIRECTORY", "./private-storage"), {
      recursive: true,
    });
    await fs.writeFile(await this.path(key), data, { flag: "wx" });
  }
  async get(key: string) {
    const fs = await import("node:fs/promises");
    try {
      return new Uint8Array(await fs.readFile(await this.path(key)));
    } catch {
      return null;
    }
  }
  async remove(key: string) {
    const fs = await import("node:fs/promises");
    await fs.unlink(await this.path(key)).catch(() => {});
  }
}
export class R2StorageProvider implements StorageProvider {
  constructor(private bucket: R2Bucket) {}
  async put(key: string, data: Uint8Array, mime: string) {
    await this.bucket.put(key, data as any, {
      httpMetadata: { contentType: mime },
    });
  }
  async get(key: string) {
    const item = await this.bucket.get(key);
    return item ? new Uint8Array(await item.arrayBuffer()) : null;
  }
  async remove(key: string) {
    await this.bucket.delete(key);
  }
}
export const storage = (): StorageProvider =>
  getRuntime()?.BUCKET
    ? new R2StorageProvider(getRuntime()!.BUCKET!)
    : new LocalStorageProvider();
