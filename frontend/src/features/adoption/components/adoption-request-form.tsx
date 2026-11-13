"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Field, fieldClass, inputClass, NativeSelect, SubmitButton } from "@/shared/forms";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { ApiStatus, getApiErrorMessage, requestApi, useApiData } from "@/shared/api";
import type { AdoptablePet } from "../types";

export function AdoptionRequestForm({ onDone, petId }: { onDone: () => void; petId?: string }) {
  const t = useT();
  const a = t.adoption;
  const { data, loading, error } = useApiData<{ mascotas: AdoptablePet[] }>("adoption/animals");
  const [saving, setSaving] = useState(false);
  const animals = data?.mascotas ?? [];
  const defaultPet = animals.some((pet) => pet.id === petId) ? petId : "";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setSaving(true);
    try {
      await requestApi("adoption/requests", {
        method: "POST",
        body: JSON.stringify({
          owner: formData.get("owner"),
          petName: formData.get("pet"),
          phone: formData.get("phone"),
          address: formData.get("address"),
          notes: formData.get("notes"),
          adoptableId: formData.get("adoptable") || null,
        }),
      });
      toast.success(a.sent);
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
      <Field id="owner" label={t.common.ownerName}>
        <Input id="owner" name="owner" placeholder={t.common.ownerPlaceholder} autoComplete="name" required className={inputClass} />
      </Field>
      <Field id="pet" label={t.common.petName}>
        <Input id="pet" name="pet" placeholder={t.common.petPlaceholder} required className={inputClass} />
      </Field>
      <Field id="phone" label={a.phone}>
        <Input id="phone" name="phone" type="tel" placeholder={a.phonePlaceholder} autoComplete="tel" required className={inputClass} />
      </Field>
      <Field id="address" label={a.address}>
        <Input id="address" name="address" placeholder={a.addressPlaceholder} autoComplete="street-address" required className={inputClass} />
      </Field>
      <Field id="notes" label={a.notes}>
        <Textarea id="notes" name="notes" className={cn(fieldClass, "min-h-28")} />
      </Field>
      <div className="grid content-start gap-4">
        <Field id="adoptable" label={a.pet}>
          <NativeSelect id="adoptable" defaultValue={defaultPet} options={animals.map((p) => ({ value: p.id, label: p.name }))} />
        </Field>
        <SubmitButton disabled={saving} />
      </div>
    </form>
  );
}
