import { NextResponse } from "next/server";
import { fetchBackendApi } from "@/shared/server/backend-api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const backendResponse = await fetchBackendApi("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await backendResponse.json()) as {
      codigo?: string;
      mensaje?: string;
      token?: string;
      usuario?: unknown;
    };

    if (!backendResponse.ok) {
      return NextResponse.json(payload, { status: backendResponse.status });
    }
    if (!payload.token || !payload.usuario) {
      console.error("La API devolvió una respuesta de login incompleta.");
      return NextResponse.json(
        { codigo: "INVALID_BACKEND_RESPONSE" },
        { status: 502 },
      );
    }

    const response = NextResponse.json({ usuario: payload.usuario });
    response.cookies.set("madivet_token", payload.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return response;
  } catch (error) {
    console.error("No se pudo completar el inicio de sesión con el backend:", error);
    return NextResponse.json(
      { codigo: "BACKEND_UNAVAILABLE" },
      { status: 502 },
    );
  }
}
