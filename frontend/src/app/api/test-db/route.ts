
import { connection, NextResponse } from "next/server";
import { fetchBackendApi } from "@/shared/server/backend-api";

export async function GET() {
    await connection();
    try {
        const response = await fetchBackendApi("/api/health");
        const result = await response.json();
        return NextResponse.json(result, { status: response.status });
    } catch (error) {
        console.error("Error comprobando la conexión con el backend:", error);
        return NextResponse.json(
            { codigo: "BACKEND_UNAVAILABLE", mensaje: "No se pudo contactar con el backend." },
            { status: 502 }
        );
    }
}
