"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { FileThumb, useFileDrop } from "@/shared/files";
import { Field, inputClass, NativeSelect, SubmitButton } from "@/shared/forms";
import { useT } from "@/shared/i18n";
import { Input } from "@/shared/ui/input";
import { ApiStatus, getApiErrorMessage, requestApi, useApiData } from "@/shared/api";

export function GroomingForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const a = t.appointments;
  const { data, loading, error } = useApiData<{ mascotas: { id: string; name: string }[] }>("pets");
  const [reference, setReference] = useState<File>();
  const [saving, setSaving] = useState(false);
  const { getRootProps, getInputProps, open, isDragActive } = useFileDrop((f) => setReference(f[0]));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const { cita } = await requestApi<{ cita: { id: string } }>("appointments", {
        method: "POST",
        body: JSON.stringify({
          type: "grooming",
          petId: formData.get("pet"),
          subject: a.groomingCreated,
          date: formData.get("date"),
        }),
      });
      let attachmentFailed = false;
      if (reference) {
        const files = new FormData();
        files.append("files", reference);
        try {
          await requestApi(`appointments/${cita.id}/attachments`, {
            method: "POST",
            body: files,
          });
        } catch (requestError) {
          attachmentFailed = true;
          toast.error(getApiErrorMessage(requestError, t.common.apiError, t.common.schemaNotReady));
        }
      }
      if (!attachmentFailed) toast.success(a.groomingCreated);
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
      <Field id="reference" label={a.reference} className="sm:row-span-2">
        <div {...getRootProps()} className={`grid min-h-40 place-items-center gap-2 bg-vet-field p-3 ${isDragActive ? "ring-2 ring-vet-lilac" : ""}`}>
          <input {...getInputProps()} id="reference" />
          {reference && <FileThumb file={reference} className="size-24" />}
          <button type="button" onClick={open} className="flex flex-col items-center gap-1 text-sm text-vet-gray">
            <Upload className="size-6" />
            {a.uploadImage}
          </button>
        </div>
      </Field>
      <Field id="date" label={a.date}>
        <Input id="date" name="date" type="date" required className={inputClass} />
      </Field>
      <SubmitButton disabled={saving} className="self-end" />
    </form>
  );
}
