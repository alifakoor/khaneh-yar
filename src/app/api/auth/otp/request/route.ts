import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, clientIp, errorResponse, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { discardOtp, issueOtp, OTP_RESEND_SECONDS } from "@/lib/otp";
import { AUTH_LIMITS, hitRateLimit } from "@/lib/rateLimit";
import { getSmsProvider } from "@/lib/sms";
import { otpRequestSchema } from "@/lib/validation";

const tooMany = () => errorResponse(429, "RATE_LIMITED", "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.");

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const json = await readJson(request);
  if ("error" in json) return json.error;
  const parsed = otpRequestSchema.safeParse(json.body);
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "شماره موبایل معتبر نیست.");
  const { phone } = parsed.data;
  const db = await getDb();
  const ip = clientIp(request);
  if (ip && !(await hitRateLimit(db, `otp-send:ip:${ip}`, AUTH_LIMITS.sendPerIp, AUTH_LIMITS.windowSeconds)))
    return tooMany();
  if (!(await hitRateLimit(db, `otp-send:phone:${phone}`, AUTH_LIMITS.sendPerPhone, AUTH_LIMITS.windowSeconds)))
    return tooMany();
  const issued = await issueOtp(db, phone);
  if (issued.status === "cooldown")
    return NextResponse.json(
      { error: { code: "TOO_SOON", message: "کد قبلی هنوز معتبر است؛ کمی صبر کنید." }, resendIn: issued.retryIn },
      { status: 429 },
    );
  try {
    await getSmsProvider().sendOtp(phone, issued.code);
  } catch (error) {
    console.error(error);
    await discardOtp(db, phone);
    return errorResponse(502, "SMS_FAILED", "ارسال پیامک انجام نشد؛ دوباره تلاش کنید.");
  }
  return NextResponse.json({ ok: true, resendIn: OTP_RESEND_SECONDS });
}
