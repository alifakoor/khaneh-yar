import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, clearSessionCookie } from "@/lib/api";

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
