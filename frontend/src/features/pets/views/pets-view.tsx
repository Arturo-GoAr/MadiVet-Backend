"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Cat, Dog, PawPrint } from "lucide-react";
import { useT } from "@/shared/i18n";
import { ApiStatus, useApiData } from "@/shared/api";

type PetRow = {
  id: string;
  name: string;
  species: "dog" | "cat" | "other";
  birthDate: string | null;
};

function ageInYears(birthDate: string) {
  const birth = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return Math.max(age, 0);
}

export function PetsView() {
  const t = useT();
  const q = (useSearchParams().get("q") ?? "").toLowerCase();
  const { data, loading, error } = useApiData<{ mascotas: PetRow[] }>("pets");
  const pets = (data?.mascotas ?? []).filter((p) => p.name.toLowerCase().includes(q));

  if (loading || error) return <ApiStatus loading={loading} error={error} />;

  if (pets.length === 0) return <p className="rounded-xl bg-white p-6 text-center text-vet-gray shadow-sm">{t.pets.empty}</p>;

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
      {pets.map((p) => {
        const Icon = p.species === "dog" ? Dog : p.species === "cat" ? Cat : PawPrint;
        return (
          <li key={p.id}>
            <Link href={`/mascotas/${p.id}`} className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm transition-colors hover:bg-vet-lilac/30">
              <span className="grid size-14 place-items-center rounded-full bg-vet-surface text-vet-gray">
                <Icon className="size-7" aria-hidden />
              </span>
              <span>
                <span className="block text-lg">{p.name}</span>
                <span className="block text-sm text-vet-gray">
                  {t.appointments[p.species]} ·{" "}
                  {p.birthDate ? `${ageInYears(p.birthDate)} ${t.pets.years}` : t.pets.ageUnknown}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
