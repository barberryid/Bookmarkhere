import { privateSeedUserId } from "./db";

export function getPrivateUserId() {
  return privateSeedUserId;
}

export function isDashboardProtectedByDeployment() {
  return Boolean(import.meta.env.ADMIN_EMAIL || import.meta.env.ADMIN_PASSWORD);
}
