import { argon2idAsync } from "@noble/hashes/argon2";
import { db } from "./database";
import { config } from "./runtime";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
export const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
export async function digest(s: string) {
  return Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
  ).toString("hex");
}
export async function hashPassword(
  password: string,
  salt = token().slice(0, 32),
) {
  const bytes = await argon2idAsync(password, salt, {
    t: 2,
    m: 19456,
    p: 1,
    dkLen: 32,
  });
  return `argon2id$${salt}$${Buffer.from(bytes).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [, salt] = stored.split("$");
  if (!salt) return false;
  const candidate = await hashPassword(password, salt);
  if (candidate.length !== stored.length) return false;
  let mismatch = 0;
  for (let i = 0; i < stored.length; i++)
    mismatch |= stored.charCodeAt(i) ^ candidate.charCodeAt(i);
  return mismatch === 0;
}
export async function rateLimit(key: string, max: number, seconds: number) {
  const client = await db();
  const now = new Date();
  const row = await client.rateLimit.findUnique({ where: { key } });
  if (!row || row.expiresAt < now) {
    await client.rateLimit.upsert({
      where: { key },
      create: {
        key,
        count: 1,
        expiresAt: new Date(Date.now() + seconds * 1000),
      },
      update: { count: 1, expiresAt: new Date(Date.now() + seconds * 1000) },
    });
    return;
  }
  const result = await client.rateLimit.updateMany({
    where: { key, count: { lt: max }, expiresAt: { gt: now } },
    data: { count: { increment: 1 } },
  });
  if (!result.count) fail(429, "Слишком много запросов. Попробуйте позже.");
}
export function csrf(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const expected = new URL(req.url).origin;
  const configured = config("APP_ORIGIN");
  if (!origin || (origin !== expected && origin !== configured))
    fail(403, "Недопустимый источник запроса.");
  if (req.headers.get("sec-fetch-site") === "cross-site")
    fail(403, "Недопустимый источник запроса.");
}
export async function readJson(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 750000)
    fail(413, "Слишком большой запрос.");
  const reader = req.body?.getReader();
  if (!reader) fail(400, "Пустой запрос.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    size += value.byteLength;
    if (size > 750000) {
      await reader!.cancel();
      fail(413, "Слишком большой запрос.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    fail(400, "Некорректный JSON.");
  }
}
export async function currentUser(req: Request) {
  const raw = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("edupilot_session="))
    ?.split("=")[1];
  if (!raw) return null;
  const client = await db();
  const session = await client.session.findUnique({
    where: { id: await digest(raw) },
    include: { user: { include: { settings: true } } },
  });
  return session && session.expiresAt > new Date() ? session.user : null;
}
export async function requireUser(req: Request) {
  return (await currentUser(req)) ?? fail(401, "Войдите в аккаунт.");
}
export function publicUser(user: any) {
  const { passwordHash, sessions, ...safe } = user;
  return safe;
}
export async function sessionCookie(userId: string, req: Request) {
  const raw = token();
  await (
    await db()
  ).session.create({
    data: {
      id: await digest(raw),
      userId,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  return `edupilot_session=${raw}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
export const clearCookie =
  "edupilot_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
