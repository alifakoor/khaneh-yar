import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, clearSessionCookie, errorResponse, readJson, requireUser, unauthorized } from "@/lib/api";
import { deleteAccountSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireUser();
  if (!auth) return unauthorized();
  return NextResponse.json({ phone: auth.user.phone, createdAt: auth.user.createdAt });
}

/** Deletes the account and all of its data. The body must repeat the account's phone number as confirmation. */
export async function DELETE(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const auth = await requireUser();
  if (!auth) return unauthorized();
  const json = await readJson(request);
  if ("error" in json) return json.error;
  const parsed = deleteAccountSchema.safeParse(json.body);
  if (!parsed.success || parsed.data.phone !== auth.user.phone)
    return errorResponse(400, "CONFIRMATION_MISMATCH", "شماره واردشده با شماره حساب یکسان نیست.");
  const ownerId = auth.user._id;
  await auth.db.collection("properties").deleteMany({ ownerId });
  await auth.db.collection("settings").deleteMany({ ownerId });
  await auth.db.collection("users").deleteOne({ _id: ownerId });
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
