import { randomBytes } from "node:crypto";

export type AtlasReferral = {
  token: string;
  expiresAt: Date;
};

export function createOpaqueAtlasReferral(now = new Date(), ttlMinutes = 30): AtlasReferral {
  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 60) {
    throw new Error("Atlas referral TTL must be between 1 and 60 minutes");
  }

  return {
    token: randomBytes(32).toString("base64url"),
    expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
  };
}

export function referralIsActive(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() > now.getTime();
}
