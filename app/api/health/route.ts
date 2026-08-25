import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Public, data-free endpoint for uptime checks. */
export function GET() {
  return NextResponse.json(
    { ok: true, service: "vynq-chat-web" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
