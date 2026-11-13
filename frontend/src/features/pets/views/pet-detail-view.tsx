"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { useLocale, useT } from "@/shared/i18n";
import { ApiStatus, useApiData } from "@/shared/api";

type PetDetails = {
  id: string;
  name: string;
  species: "dog" | "cat" | "other";
  sex: "male" | "female" | "unknown";
  birthDate: string | null;
  vaccines: { id: string; name: string; date: string; next: string | null }[];
};

const locales = { es, en: enUS };

export function PetDetailView({ id }: { id: string }) {
  const t = useT();
  const locale = locales[useLocale()];
  const { data, loading, error } = useApiData<{ mascota: PetDetails }>(`pets/${id}`);
  if (loading || error) return <ApiStatus loading={loading} error={error} />;
  const pet = data?.mascota;
  if (!pet) return <ApiStatus loading={false} error={new Error(t.common.apiError)} />;
  const day = (d: string) => format(parseISO(d), "PPP", { locale });
  const age = pet.birthDate
    ? Math.max(0, new Date().getFullYear() - new Date(`${pet.birthDate}T00:00:00`).getFullYear())
    : null;

  return (
    <div className="grid gap-4">
      <Link href="/mascotas" className="flex w-fit items-center gap-1.5 text-sm text-vet-gray hover:text-black">
        <ArrowLeft className="size-4" />
        {t.screens.pets}
      </Link>
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl">{pet.name}</h1>
        <p className="mt-1 text-vet-gray">
          {t.appointments[pet.species]} · {t.appointments[pet.sex]} ·{" "}
          {age === null ? t.pets.ageUnknown : `${age} ${t.pets.years}`}
        </p>
      </section>
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-xl uppercase">{t.pets.vaccines}</h2>
        {pet.vaccines.length === 0 ? (
          <p className="mt-2 text-vet-gray">{t.pets.noVaccines}</p>
        ) : (
          <ul className="mt-3 divide-y">
            {pet.vaccines.map((v) => (
              <li key={`${v.name}-${v.date}`} className="py-3">
                <p>{v.name}</p>
                <p className="text-sm text-vet-gray">
                  {day(v.date)}
                  {v.next && ` · ${t.pets.nextDose}: ${day(v.next)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
