import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchBackendApi } from "@/shared/server/backend-api";

export type Role = "client" | "staff";
export type Session = { name: string; role: Role };

export async function getSession(): Promise<Session> {
  const token = (await cookies()).get("madivet_token")?.value;
  if (!token) redirect("/login");

  let response: Response;
  try {
    response = await fetchBackendApi("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    console.error("No se pudo contactar la API para validar la sesión:", error);
    throw new Error("No se pudo validar la sesión con el backend.");
  }

  if (response.status === 401 || response.status === 403) redirect("/login");
  if (!response.ok) {
    throw new Error(`El backend no pudo validar la sesión (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as {
    usuario?: { nombre?: string; rol?: string };
  };
  const user = payload.usuario;
  if (!user?.nombre || (user.rol !== "client" && user.rol !== "staff")) {
    throw new Error("El backend devolvió una sesión con formato inválido.");
  }

  return { name: user.nombre, role: user.rol };
}
