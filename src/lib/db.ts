export type D1DatabaseBinding = {
  prepare: (query: string) => unknown;
};

export const privateSeedUserId = "user_private_seed";

export function requireDatabase(env: { DB?: D1DatabaseBinding }) {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding DB is not configured.");
  }

  return env.DB;
}
