"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, requestApi } from "./client";

export function useApiData<T>(path: string) {
  const [result, setResult] = useState<{
    key: string;
    data?: T;
    error?: unknown;
  }>();
  const [revision, setRevision] = useState(0);
  const key = `${path}\u0000${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("madivet:refresh", refresh);

    requestApi<T>(path, { signal: controller.signal })
      .then((data) => setResult({ key, data }))
      .catch((requestError: unknown) => {
        if (
          requestError instanceof ApiError ||
          !(requestError instanceof DOMException && requestError.name === "AbortError")
        ) {
          setResult({ key, error: requestError });
        }
      });

    return () => {
      controller.abort();
      window.removeEventListener("madivet:refresh", refresh);
    };
  }, [key, path]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const currentResult = result?.key === key ? result : undefined;
  return {
    data: currentResult?.data,
    loading: !currentResult,
    error: currentResult?.error,
    reload,
  };
}
