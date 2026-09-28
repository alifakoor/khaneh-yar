import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, errorResponse, readJson, requireUser, unauthorized } from "@/lib/api";
import { MAX_PROPERTIES_PER_USER, propertySchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireUser();
  if (!auth) return unauthorized();
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
  if (!auth) return unauthorized();
  const json = await readJson(request);
  if ("error" in json) return json.error;
  const parsed = propertySchema.safeParse(json.body);
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "اطلاعات ملک معتبر نیست.");
  if ((await auth.db.collection("properties").countDocuments({ ownerId: auth.user._id })) >= MAX_PROPERTIES_PER_USER)
    return errorResponse(409, "LIMIT_REACHED", `حداکثر ${MAX_PROPERTIES_PER_USER} ملک می‌توانید ثبت کنید.`);
  const now = new Date();
  try {
    await auth.db.collection("properties").insertOne({
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
