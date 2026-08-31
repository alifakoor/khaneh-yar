import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, type UserDocument } from "./db";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0] || request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0] || request.headers.get("host");
  const expected = host ? `${protocol}://${host}` : request.nextUrl.origin;
  if (!origin || origin !== expected) return errorResponse(403, "INVALID_ORIGIN", "درخواست نامعتبر است.");
}

export async function requireUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session || !ObjectId.isValid(session.userId)) return null;
  const db = await getDb();
  const user = await db.collection<UserDocument>("users").findOne({ _id: new ObjectId(session.userId) });
  if (!user || user.username !== session.username || user.tokenVersion !== session.tokenVersion) return null;
  return { db, user };
}
