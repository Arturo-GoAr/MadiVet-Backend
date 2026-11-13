"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getApiErrorMessage(
  error: unknown,
  fallback: string,
  schemaNotReady: string,
) {
  if (error instanceof ApiError && error.code === "SCHEMA_NOT_READY") {
    return schemaNotReady;
  }
  if (error instanceof ApiError) return error.message;
  return fallback;
}

export async function requestApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const [resource, query] = path.split("?", 2);
  const safePath = resource
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  const headers = new Headers(init.headers);
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(
    `/api/backend/${safePath}${query ? `?${query}` : ""}`,
    { ...init, headers, credentials: "same-origin", cache: "no-store" },
  );
  const isMutation = !["GET", "HEAD"].includes((init.method || "GET").toUpperCase());
  if (response.status === 204) {
    if (isMutation && typeof window !== "undefined") {
      window.dispatchEvent(new Event("madivet:refresh"));
    }
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const data =
      typeof payload === "object" && payload !== null
        ? (payload as { codigo?: unknown; mensaje?: unknown })
        : {};
    throw new ApiError(
      typeof data.mensaje === "string" ? data.mensaje : `HTTP ${response.status}`,
      typeof data.codigo === "string" ? data.codigo : "API_ERROR",
      response.status,
    );
  }

  if (isMutation && typeof window !== "undefined") {
    window.dispatchEvent(new Event("madivet:refresh"));
  }

  return payload as T;
}
