import type { Db } from "mongodb";

interface RateLimitDocument {
  _id: string;
  count: number;
  expiresAt: Date;
}

/**
 * Counts one hit against `key` in a fixed window and reports whether it is within `limit`.
 * A single pipeline update keeps it atomic: an expired window is reset, a live one is incremented.
 */
export async function hitRateLimit(db: Db, key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const live = { $gt: ["$expiresAt", now] };
  const doc = await db.collection<RateLimitDocument>("rate_limits").findOneAndUpdate(
    { _id: key },
    [
      {
        $set: {
          count: { $cond: [live, { $add: ["$count", 1] }, 1] },
          expiresAt: { $cond: [live, "$expiresAt", new Date(now.getTime() + windowSeconds * 1000)] },
        },
      },
    ],
    { upsert: true, returnDocument: "after" },
  );
  return (doc?.count ?? 1) <= limit;
}

/** Per-hour limits for the OTP endpoints. */
export const AUTH_LIMITS = {
  sendPerPhone: 5,
  sendPerIp: 20,
  verifyPerPhone: 10,
  verifyPerIp: 50,
  windowSeconds: 60 * 60,
};
