import { privateSeedUserId } from "./db";

/**
 * Private MVP: every request acts as the seed user. Dashboard protection is
 * handled at the deployment layer (Cloudflare Access) per the brief.
 * Multi-user auth replaces this in a later milestone.
 */
export function getPrivateUserId(): string {
  return privateSeedUserId;
}
