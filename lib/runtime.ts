import { AsyncLocalStorage } from "node:async_hooks";
export type Runtime = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  ASSETS?: Fetcher;
  [key: string]: unknown;
};
const runtime = new AsyncLocalStorage<Runtime>();
export const withRuntime = <T>(env: Runtime, fn: () => T) =>
  runtime.run(env, fn);
export const getRuntime = () => runtime.getStore();
export const config = (name: string, fallback = "") =>
  String(getRuntime()?.[name] ?? process.env[name] ?? fallback);
