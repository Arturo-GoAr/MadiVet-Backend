"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { useLocale, useT } from "@/shared/i18n";
import { ApiStatus, useApiData } from "@/shared/api";
import type { AppointmentType } from "../types";

const locales = { es, en: enUS };
type AppointmentDetails = {
  id: string;
  type: AppointmentType;
  pet: string | null;
  date: string;
  subject: string;
};

// `chat` llega por slot desde la page para no importar de otra feature.
export function AppointmentDetailView({ id, chat }: { id: string; chat: React.ReactNode }) {
  const t = useT();
  const a = t.appointments;
  const locale = locales[useLocale()];
  const { data, loading, error } = useApiData<{ cita: AppointmentDetails }>(`appointments/${id}`);
  if (loading || error) return <ApiStatus loading={loading} error={error} />;
  const appointment = data?.cita;
  if (!appointment) return <ApiStatus loading={false} error={new Error(t.common.apiError)} />;

  const rows = [
    [t.common.petName, appointment.pet || "—"],
    [a.date, format(parseISO(appointment.date), "PPP", { locale })],
    [a.subject, appointment.subject],
  ];

  return (
    <div className="grid gap-4">
      <Link href="/citas" className="flex w-fit items-center gap-1.5 text-sm text-vet-gray hover:text-black">
        <ArrowLeft className="size-4" />
        {t.screens.appointments}
      </Link>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section className="content-start rounded-xl bg-white p-5 shadow-sm">
          <h1 className="text-2xl">{a.types[appointment.type]}</h1>
          <dl className="mt-4 grid gap-3">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase text-vet-gray">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        {chat}
      </div>
    </div>
  );
}
