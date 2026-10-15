import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getRuntime, config } from "./runtime";
let local: PrismaClient | undefined;
const cloud = new WeakMap<object, PrismaClient>();
export async function db(): Promise<PrismaClient> {
  const binding = getRuntime()?.DB;
  if (binding) {
    let client = cloud.get(binding);
    if (!client) {
      client = new PrismaClient({ adapter: new PrismaD1(binding) });
      cloud.set(binding, client);
    }
    return client;
  }
  if (!local) {
    const { createLocalClient } = await import("@local-db");
    local = createLocalClient();
  }
  return local;
}
