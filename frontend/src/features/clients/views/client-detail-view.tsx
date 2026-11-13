"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/shared/i18n";
import { ApiStatus, useApiData } from "@/shared/api";

type ClientDetails = {
  cliente: {
    nombre: string;
    correo: string;
    telefono: string | null;
    mascotas: { id: string; nombre: string }[];
  };
};

export function ClientDetailView({ id }: { id: string }) {
  const t = useT();
  const { data, loading, error } = useApiData<ClientDetails>(`clients/${id}`);
  if (loading || error) return <ApiStatus loading={loading} error={error} />;
  const client = data?.cliente;
  if (!client) return <ApiStatus loading={false} error={new Error(t.common.apiError)} />;

  return (
    <div className="grid gap-4">
      <Link href="/clientes" className="flex w-fit items-center gap-1.5 text-sm text-vet-gray hover:text-black">
        <ArrowLeft className="size-4" />
        {t.screens.clients}
      </Link>
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl">{client.nombre}</h1>
        <dl className="mt-4 grid gap-3">
          <div>
            <dt className="text-xs uppercase text-vet-gray">{t.clients.phone}</dt>
            <dd>{client.telefono || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-vet-gray">{t.common.email}</dt>
            <dd>{client.correo}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-vet-gray">{t.clients.pets}</dt>
            <dd>{client.mascotas.map((pet) => pet.nombre).join(", ") || "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
