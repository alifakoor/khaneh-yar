import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { Db, ObjectId } from "mongodb";
import { sessionSecret } from "./session";

export const OTP_LENGTH = 5;
export const OTP_TTL_SECONDS = 120;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;

interface OtpDocument {
  _id: ObjectId;
  phone: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}

export function generateOtp() {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

export function hashOtp(phone: string, code: string) {
  return createHmac("sha256", sessionSecret()).update(`otp:${phone}:${code}`).digest("hex");
}

export function otpMatches(phone: string, code: string, codeHash: string) {
  const actual = Buffer.from(hashOtp(phone, code), "hex");
  const expected = Buffer.from(codeHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const otps = (db: Db) => db.collection<OtpDocument>("otp_codes");

/**
 * Stores a fresh code for `phone` unless one was issued less than OTP_RESEND_SECONDS ago.
 * The cooldown is enforced atomically: the filter only matches an old code, so a recent one
 * makes the upsert collide with the unique phone index instead of replacing it.
 */
export async function issueOtp(
  db: Db,
  phone: string,
): Promise<{ status: "issued"; code: string } | { status: "cooldown"; retryIn: number }> {
  const now = new Date();
  const code = generateOtp();
  try {
    await otps(db).updateOne(
      { phone, createdAt: { $lte: new Date(now.getTime() - OTP_RESEND_SECONDS * 1000) } },
      {
        $set: {
          codeHash: hashOtp(phone, code),
          attempts: 0,
          expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
          createdAt: now,
        },
      },
      { upsert: true },
    );
    return { status: "issued", code };
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const existing = await otps(db).findOne({ phone });
    const elapsed = existing ? (now.getTime() - existing.createdAt.getTime()) / 1000 : OTP_RESEND_SECONDS;
    return { status: "cooldown", retryIn: Math.max(1, Math.ceil(OTP_RESEND_SECONDS - elapsed)) };
  }
}

export async function discardOtp(db: Db, phone: string) {
  await otps(db).deleteOne({ phone });
}

/** Consumes one attempt; succeeds only once per code, before expiry and within the attempt limit. */
export async function verifyOtp(db: Db, phone: string, code: string) {
  const doc = await otps(db).findOneAndUpdate(
    { phone, expiresAt: { $gt: new Date() }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (!doc || !otpMatches(phone, code, doc.codeHash)) return false;
  const deleted = await otps(db).deleteOne({ _id: doc._id, codeHash: doc.codeHash });
  return deleted.deletedCount === 1;
}

export function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
