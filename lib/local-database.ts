import { PrismaClient } from "@prisma/client";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import { config } from "./runtime";
export const createLocalClient = () =>
  new PrismaClient({
    adapter: new PrismaBetterSQLite3({
      url: config("DATABASE_URL", "file:./prisma/edupilot.db"),
    }),
  });
