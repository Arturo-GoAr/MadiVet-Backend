import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { backendApiUrl } from "@/shared/server/backend-api";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: RouteContext) {
  const token = (await cookies()).get("madivet_token")?.value;
  if (!token) {
    return NextResponse.json(
      { codigo: "TOKEN_REQUIRED" },
      { status: 401 },
    );
  }

  const { path } = await context.params;
  const safePath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const url = new URL(
    backendApiUrl(`/api/${safePath}`),
  );
  url.search = request.nextUrl.search;

  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  try {
    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.arrayBuffer();
    const backendResponse = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    for (const header of ["content-type", "content-disposition"]) {
      const value = backendResponse.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("No se pudo contactar con la API MädiVet:", error);
    return NextResponse.json(
      { codigo: "BACKEND_UNAVAILABLE" },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
