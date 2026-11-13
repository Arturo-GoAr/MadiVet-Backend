export function backendApiUrl(path: string) {
  const baseUrl = process.env.BACKEND_API_URL || "http://localhost:4000";
  return new URL(path, baseUrl).toString();
}

export function fetchBackendApi(path: string, init?: RequestInit) {
  return fetch(backendApiUrl(path), {
    ...init,
    cache: "no-store",
  });
}
