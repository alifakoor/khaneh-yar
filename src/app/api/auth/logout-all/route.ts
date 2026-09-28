import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, clearSessionCookie, requireUser, unauthorized } from "@/lib/api";

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const auth = await requireUser();
  if (!auth) return unauthorized();
  await auth.db
    .collection("users")
    .updateOne({ _id: auth.user._id }, { $inc: { tokenVersion: 1 }, $set: { updatedAt: new Date() } });
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
