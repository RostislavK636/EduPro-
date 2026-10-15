import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
if (!existsSync(".env")) copyFileSync(".env.example", ".env");
process.loadEnvFile?.(".env");
const filename = (
  process.env.DATABASE_URL || "file:./prisma/edupilot.db"
).replace(/^file:/, "");
process.env.DATABASE_URL = "file:" + resolve(filename).replaceAll("\\", "/");
mkdirSync("prisma", { recursive: true });
mkdirSync(process.env.STORAGE_DIRECTORY || "private-storage", {
  recursive: true,
});
new Database(resolve(filename)).close();
const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { stdio: "inherit", env: process.env },
);
if (result.status !== 0) process.exit(result.status || 1);
console.log(
  "EduPilot готов. Запустите npm run dev. Аккаунты создаются через форму регистрации.",
);
