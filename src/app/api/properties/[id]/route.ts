import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, errorResponse, readJson, requireUser, unauthorized } from "@/lib/api";
import { propertySchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const auth = await requireUser();
  if (!auth) return unauthorized();
  const { id } = await params;
  const json = await readJson(request);
  if ("error" in json) return json.error;
  const body = json.body as Record<string, unknown> | null;
  const version = body?.version as number;
  const parsed = propertySchema.safeParse(
    body && typeof body === "object"
      ? Object.fromEntries(Object.entries(body).filter(([key]) => key !== "version"))
      : body,
  );
  if (!parsed.success || parsed.data.id !== id || !Number.isInteger(version) || version < 1)
    return errorResponse(400, "VALIDATION_ERROR", "اطلاعات ملک یا نسخه معتبر نیست.");
  const result = await auth.db
    .collection("properties")
    .findOneAndUpdate(
      { ownerId: auth.user._id, id, version },
      { $set: { payload: parsed.data, updatedAt: new Date(), schemaVersion: 1 }, $inc: { version: 1 } },
      { returnDocument: "after" },
    );
  if (!result) {
    const exists = await auth.db.collection("properties").findOne({ ownerId: auth.user._id, id });
    return exists
      ? errorResponse(409, "VERSION_CONFLICT", "این ملک در جای دیگری تغییر کرده است؛ داده‌ها را تازه‌سازی کنید.")
      : errorResponse(404, "NOT_FOUND", "ملک پیدا نشد.");
  }
  return NextResponse.json({ ...(result.payload as object), version: result.version });
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const auth = await requireUser();
  if (!auth) return unauthorized();
  const { id } = await params;
  const version = Number(request.nextUrl.searchParams.get("version"));
  if (!Number.isInteger(version) || version < 1) return errorResponse(400, "VALIDATION_ERROR", "نسخه معتبر نیست.");
  const result = await auth.db.collection("properties").deleteOne({ ownerId: auth.user._id, id, version });
  if (!result.deletedCount) {
    const exists = await auth.db.collection("properties").findOne({ ownerId: auth.user._id, id });
    return exists
      ? errorResponse(409, "VERSION_CONFLICT", "این ملک در جای دیگری تغییر کرده است؛ داده‌ها را تازه‌سازی کنید.")
      : errorResponse(404, "NOT_FOUND", "ملک پیدا نشد.");
  }
  return NextResponse.json({ ok: true });
}
