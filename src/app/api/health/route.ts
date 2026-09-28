import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe: 200 when the app can reach MongoDB. */
export async function GET() {
  try {
    await (await getDb()).command({ ping: 1 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
