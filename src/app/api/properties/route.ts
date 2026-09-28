import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, errorResponse, requireUser } from "@/lib/api";
import { propertySchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireUser();
  if (!auth) return errorResponse(401, "UNAUTHORIZED", "نشست شما معتبر نیست.");
  const docs = await auth.db
    .collection("properties")
    .find({ ownerId: auth.user._id })
    .sort({ createdAt: -1 })
    .toArray();
  return NextResponse.json(docs.map((d) => ({ ...(d.payload as object), version: d.version })));
}

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const auth = await requireUser();
  if (!auth) return errorResponse(401, "UNAUTHORIZED", "نشست شما معتبر نیست.");
  const parsed = propertySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "اطلاعات ملک معتبر نیست.");
  const now = new Date();
  try {
    await auth.db
      .collection("properties")
      .insertOne({
        ownerId: auth.user._id,
        id: parsed.data.id,
        schemaVersion: 1,
        version: 1,
        payload: parsed.data,
        createdAt: new Date(parsed.data.createdAt),
        updatedAt: now,
      });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000)
      return errorResponse(409, "ALREADY_EXISTS", "این ملک قبلاً ثبت شده است.");
    throw error;
  }
  return NextResponse.json({ ...parsed.data, version: 1 }, { status: 201 });
}
