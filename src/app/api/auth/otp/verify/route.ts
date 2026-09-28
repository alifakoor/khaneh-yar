import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, clientIp, errorResponse, readJson, setSessionCookie } from "@/lib/api";
import { getDb, seedUserData, type UserDocument } from "@/lib/db";
import { isDuplicateKey, verifyOtp } from "@/lib/otp";
import { AUTH_LIMITS, hitRateLimit } from "@/lib/rateLimit";
import { createSessionToken } from "@/lib/session";
import { otpVerifySchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const json = await readJson(request);
  if ("error" in json) return json.error;
  const parsed = otpVerifySchema.safeParse(json.body);
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "شماره موبایل یا کد معتبر نیست.");
  const { phone, code } = parsed.data;
  const db = await getDb();
  const ip = clientIp(request);
  if (
    (ip && !(await hitRateLimit(db, `otp-verify:ip:${ip}`, AUTH_LIMITS.verifyPerIp, AUTH_LIMITS.windowSeconds))) ||
    !(await hitRateLimit(db, `otp-verify:phone:${phone}`, AUTH_LIMITS.verifyPerPhone, AUTH_LIMITS.windowSeconds))
  )
    return errorResponse(429, "RATE_LIMITED", "تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.");
  if (!(await verifyOtp(db, phone, code)))
    return errorResponse(401, "INVALID_CODE", "کد وارد‌شده اشتباه یا منقضی است.");

  const user = await upsertUser(db, phone);
  if (!user.seededAt) {
    await seedUserData(db, user._id);
    await db.collection<UserDocument>("users").updateOne({ _id: user._id }, { $set: { seededAt: new Date() } });
  }
  const token = await createSessionToken({ userId: user._id.toHexString(), tokenVersion: user.tokenVersion });
  return setSessionCookie(NextResponse.json({ phone: user.phone }), token);
}

async function upsertUser(db: Awaited<ReturnType<typeof getDb>>, phone: string): Promise<UserDocument> {
  const users = db.collection<UserDocument>("users");
  const now = new Date();
  const upsert = () =>
    users.findOneAndUpdate(
      { phone },
      { $setOnInsert: { phone, tokenVersion: 0, createdAt: now }, $set: { updatedAt: now } },
      { upsert: true, returnDocument: "after" },
    );
  try {
    return (await upsert())!;
  } catch (error) {
    // Two concurrent first logins can both try to insert; the loser retries and finds the winner's document.
    if (!isDuplicateKey(error)) throw error;
    return (await upsert())!;
  }
}
