import { NextRequest, NextResponse } from "next/server";
import { getDb, type UserDocument } from "@/lib/db";
import { checkOrigin, errorResponse } from "@/lib/api";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/password";

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request); if (originError) return originError;
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "نام کاربری و رمز عبور الزامی است.");
  const db = await getDb();
  const user = await db.collection<UserDocument>("users").findOne({ username: parsed.data.username });
  if (!user || !await verifyPassword(parsed.data.password, user.passwordHash)) return errorResponse(401, "INVALID_CREDENTIALS", "نام کاربری یا رمز عبور صحیح نیست.");
  const token = await createSessionToken({ userId: user._id.toHexString(), username: user.username, tokenVersion: user.tokenVersion });
  const response = NextResponse.json({ username: user.username });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
  return response;
}
