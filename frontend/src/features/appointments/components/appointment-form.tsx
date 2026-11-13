"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Field, fieldClass, inputClass, NativeSelect, SubmitButton } from "@/shared/forms";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { ApiStatus, getApiErrorMessage, requestApi, useApiData } from "@/shared/api";

export function AppointmentForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const a = t.appointments;
  const { data, loading, error } = useApiData<{ mascotas: { id: string; name: string }[] }>("pets");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setSaving(true);
    try {
      await requestApi("appointments", {
        method: "POST",
        body: JSON.stringify({
          type: "medical",
          petId: formData.get("pet"),
          subject: formData.get("subject"),
          date: formData.get("date"),
        }),
      });
      toast.success(a.created);
      onDone();
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, t.common.apiError, t.common.schemaNotReady));
    } finally {
      setSaving(false);
    }
  }

  if (loading || error) return <ApiStatus loading={loading} error={error} />;

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field id="pet" label={a.pet} className="sm:col-span-2">
        <NativeSelect id="pet" options={(data?.mascotas ?? []).map((p) => ({ value: p.id, label: p.name }))} />
      </Field>
      <Field id="subject" label={a.subject} className="sm:col-span-2">
        <Textarea id="subject" name="subject" placeholder={a.subjectPlaceholder} required className={cn(fieldClass, "min-h-24")} />
      </Field>
      <Field id="date" label={a.date}>
        <Input id="date" name="date" type="date" required className={inputClass} />
      </Field>
      <SubmitButton disabled={saving} className="self-end" />
    </form>
  );
}
