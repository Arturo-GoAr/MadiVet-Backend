"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useT } from "@/shared/i18n";
import { ApiStatus, useApiData } from "@/shared/api";

type ClientRow = { id: string; nombre: string; mascotas: string[] };

export function ClientsView() {
  const t = useT();
  const q = (useSearchParams().get("q") ?? "").toLowerCase();
  const { data, loading, error } = useApiData<{ clientes: ClientRow[] }>("clients");
  const clients = (data?.clientes ?? []).filter((c) => `${c.nombre} ${c.mascotas.join(" ")}`.toLowerCase().includes(q));

  if (loading || error) return <ApiStatus loading={loading} error={error} />;

  if (clients.length === 0) return <p className="rounded-xl bg-white p-6 text-center text-vet-gray shadow-sm">{t.clients.empty}</p>;

  return (
    <ul className="divide-y rounded-xl bg-white shadow-sm">
      {clients.map((c) => (
        <li key={c.id}>
          <Link href={`/clientes/${c.id}`} className="block p-4 hover:bg-vet-surface">
            <span className="block">{c.nombre}</span>
            <span className="block text-sm text-vet-gray">{c.mascotas.join(", ")}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
