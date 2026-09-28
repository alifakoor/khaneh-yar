import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, type UserDocument } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, verifySessionToken } from "./session";

export const MAX_BODY_BYTES = 100_000;

export function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export const unauthorized = () => errorResponse(401, "UNAUTHORIZED", "نشست شما معتبر نیست.");

function expectedOrigin(request: NextRequest) {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("APP_ORIGIN is required in production");
  const host = request.headers.get("host");
  return host ? `${request.nextUrl.protocol}//${host}` : request.nextUrl.origin;
}

export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== expectedOrigin(request))
    return errorResponse(403, "INVALID_ORIGIN", "درخواست نامعتبر است.");
}

/**
 * Client IP as reported by the trusted ingress/reverse proxy (header name from CLIENT_IP_HEADER,
 * default `x-real-ip`; for `x-forwarded-for` the first entry is used). Returns null when absent,
 * so callers can skip per-IP limits instead of lumping every user into one bucket.
 */
export function clientIp(request: NextRequest) {
  const header = (process.env.CLIENT_IP_HEADER || "x-real-ip").toLowerCase();
  const ip = request.headers.get(header)?.split(",")[0]?.trim();
  return ip || null;
}

/** Reads a JSON body up to MAX_BODY_BYTES; invalid JSON yields `null` so schema validation rejects it. */
export async function readJson(request: NextRequest): Promise<{ body: unknown } | { error: NextResponse }> {
  const tooLarge = () => ({ error: errorResponse(413, "PAYLOAD_TOO_LARGE", "حجم درخواست بیش از حد مجاز است.") });
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return tooLarge();
  const text = await request.text().catch(() => "");
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return tooLarge();
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { body: null };
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function requireUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session || !ObjectId.isValid(session.userId)) return null;
  const db = await getDb();
  const user = await db.collection<UserDocument>("users").findOne({ _id: new ObjectId(session.userId) });
  if (!user || !user.phone || user.tokenVersion !== session.tokenVersion) return null;
  return { db, user };
}
