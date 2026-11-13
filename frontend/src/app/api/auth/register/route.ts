import { NextResponse } from "next/server";
import { fetchBackendApi } from "@/shared/server/backend-api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const backendResponse = await fetchBackendApi("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await backendResponse.json();
    return NextResponse.json(payload, { status: backendResponse.status });
  } catch (error) {
    console.error("No se pudo completar el registro con el backend:", error);
    return NextResponse.json(
      { codigo: "BACKEND_UNAVAILABLE" },
      { status: 502 },
    );
  }
}
