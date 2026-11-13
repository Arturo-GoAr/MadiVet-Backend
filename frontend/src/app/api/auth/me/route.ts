import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchBackendApi } from "@/shared/server/backend-api";

export async function GET() {
  const token = (await cookies()).get("madivet_token")?.value;
  if (!token) {
    return NextResponse.json({ codigo: "TOKEN_REQUIRED" }, { status: 401 });
  }

  try {
    const backendResponse = await fetchBackendApi("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await backendResponse.json();
    return NextResponse.json(payload, { status: backendResponse.status });
  } catch (error) {
    console.error("No se pudo validar la sesión con el backend:", error);
    return NextResponse.json(
      { codigo: "BACKEND_UNAVAILABLE" },
      { status: 502 },
    );
  }
}
