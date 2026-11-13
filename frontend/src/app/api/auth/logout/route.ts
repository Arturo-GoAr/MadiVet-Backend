import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("madivet_token");
  return response;
}

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("madivet_token");
  return response;
}
