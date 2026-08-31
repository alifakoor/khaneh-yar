import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, errorResponse, requireUser } from "@/lib/api";
import { settingsSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireUser(); if (!auth) return errorResponse(401, "UNAUTHORIZED", "نشست شما معتبر نیست.");
  const doc = await auth.db.collection("settings").findOne({ ownerId: auth.user._id });
  if (!doc) return errorResponse(404, "NOT_FOUND", "تنظیمات پیدا نشد.");
  return NextResponse.json({ ...doc.payload as object, version: doc.version });
}

export async function PUT(request: NextRequest) {
  const originError = checkOrigin(request); if (originError) return originError;
  const auth = await requireUser(); if (!auth) return errorResponse(401, "UNAUTHORIZED", "نشست شما معتبر نیست.");
  const body = await request.json().catch(() => null); const version = body?.version;
  const parsed = settingsSchema.safeParse(body && typeof body === "object" ? Object.fromEntries(Object.entries(body).filter(([key]) => key !== "version")) : body);
  if (!parsed.success || !Number.isInteger(version) || version < 1) return errorResponse(400, "VALIDATION_ERROR", "تنظیمات یا نسخه معتبر نیست.");
  const result = await auth.db.collection("settings").findOneAndUpdate({ ownerId: auth.user._id, version }, { $set: { payload: parsed.data, updatedAt: new Date(), schemaVersion: 1 }, $inc: { version: 1 } }, { returnDocument: "after" });
  if (!result) return errorResponse(409, "VERSION_CONFLICT", "تنظیمات در جای دیگری تغییر کرده است؛ داده‌ها را تازه‌سازی کنید.");
  return NextResponse.json({ ...result.payload as object, version: result.version });
}
