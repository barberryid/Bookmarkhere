import { env } from "cloudflare:workers";

export const privateSeedUserId = "user_private_seed";
export const uncategorisedCategoryId = "cat_uncategorised";

export function getDb(): D1Database {
  const db = env.DB;
  if (!db) {
    throw new Error("Cloudflare D1 binding DB is not configured.");
  }
  return db;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
