"use client";

import { useT } from "@/shared/i18n";
import { getApiErrorMessage } from "./client";

export function ApiStatus({
  loading,
  error,
}: {
  loading: boolean;
  error: unknown;
}) {
  const t = useT();
  if (loading) {
    return (
      <p role="status" className="rounded-xl bg-white p-6 text-center text-vet-gray shadow-sm">
        {t.common.loading}
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="rounded-xl bg-white p-6 text-center text-destructive shadow-sm">
        {getApiErrorMessage(error, t.common.apiError, t.common.schemaNotReady)}
      </p>
    );
  }
  return null;
}
