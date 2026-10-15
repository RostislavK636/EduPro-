export function createLocalClient(): never {
  throw new Error("D1 binding DB is required in hosted deployments.");
}
