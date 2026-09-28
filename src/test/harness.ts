import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest, NextResponse } from "next/server";
import { closeDb, getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";
import { setSmsProvider } from "@/lib/sms";
import * as otpRequest from "@/app/api/auth/otp/request/route";
import * as otpVerify from "@/app/api/auth/otp/verify/route";
import { cookieJar } from "./setup";

export const ORIGIN = "http://localhost:3000";
export const sentSms: { phone: string; code: string }[] = [];

let server: MongoMemoryServer | undefined;

export async function startDb() {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  process.env.MONGODB_DB = "khanehyar-test";
  setSmsProvider({
    async sendOtp(phone, code) {
      sentSms.push({ phone, code });
    },
  });
  return getDb();
}

export async function stopDb() {
  setSmsProvider(null);
  await closeDb();
  await server?.stop();
}

/** Empties every collection (indexes are kept) and forgets the current session. */
export async function resetDb() {
  const db = await getDb();
  for (const c of await db.collections()) await c.deleteMany({});
  sentSms.length = 0;
  cookieJar.value = undefined;
}

export function req(
  method: string,
  path: string,
  {
    body,
    ip = "10.0.0.1",
    origin = ORIGIN,
    headers: extra = {},
  }: { body?: unknown; ip?: string | null; origin?: string | null; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { "content-type": "application/json", ...extra };
  if (ip) headers["x-real-ip"] = ip;
  if (origin) headers.origin = origin;
  return new NextRequest(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

export const json = async (response: Response) => response.json();

export function sessionFrom(response: NextResponse) {
  return response.cookies.get(SESSION_COOKIE)?.value;
}

/** Runs the full OTP flow for `phone` and makes the resulting session current. */
export async function login(phone: string, ip?: string) {
  const sent = await otpRequest.POST(req("POST", "/api/auth/otp/request", { body: { phone }, ip }));
  if (sent.status !== 200) throw new Error(`otp request failed: ${sent.status} ${JSON.stringify(await sent.json())}`);
  const code = sentSms.at(-1)!.code;
  const verified = await otpVerify.POST(req("POST", "/api/auth/otp/verify", { body: { phone, code }, ip }));
  if (verified.status !== 200) throw new Error(`otp verify failed: ${verified.status}`);
  cookieJar.value = sessionFrom(verified);
  return cookieJar.value!;
}

export { cookieJar };
