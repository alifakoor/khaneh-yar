import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, errorResponse, requireUser } from "@/lib/api";
import { changePasswordSchema } from "@/lib/validation";
import { SESSION_COOKIE } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function PUT(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const auth = await requireUser();
  if (!auth) return errorResponse(401, "UNAUTHORIZED", "نشست شما معتبر نیست.");
  const parsed = changePasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "رمز جدید باید حداقل ۱۲ نویسه باشد.");
  if (!(await verifyPassword(parsed.data.currentPassword, auth.user.passwordHash)))
    return errorResponse(400, "INVALID_PASSWORD", "رمز فعلی صحیح نیست.");
  await auth.db
    .collection("users")
    .updateOne(
      { _id: auth.user._id },
      {
        $set: { passwordHash: await hashPassword(parsed.data.newPassword), updatedAt: new Date() },
        $inc: { tokenVersion: 1 },
      },
    );
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
