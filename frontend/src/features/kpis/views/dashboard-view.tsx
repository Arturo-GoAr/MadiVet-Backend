"use client";

import { useT } from "@/shared/i18n";
import { useOpenModal } from "@/shared/modal";
import type { Role } from "@/shared/session";
import { ApiStatus, useApiData } from "@/shared/api";

type DashboardStats = {
  registered?: number;
  today?: number;
  unread?: number;
  upcoming?: number;
  daysSince?: number | null;
};

const STAT_KEYS: Record<Role, (keyof DashboardStats)[]> = {
  staff: ["registered", "today", "unread"],
  client: ["upcoming", "daysSince", "unread"],
};
const ACTIONS = ["newAppointment", "adoptionRequest", "newGrooming"] as const;

const card = "rounded-xl bg-white p-5 shadow-sm";

export function DashboardView({ role }: { role: Role }) {
  const t = useT();
  const openModal = useOpenModal();
  const { data, loading, error } = useApiData<DashboardStats>("dashboard");
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="lg:col-span-2">
        <ApiStatus loading={loading} error={error} />
      </div>
      <div className="grid content-start gap-4">
        <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
          {STAT_KEYS[role].map((key) => {
            const value = data?.[key];
            const n = typeof value === "number" ? value : null;
            return (
            <div key={key} className={card}>
              <p className="text-5xl">{loading || error ? "—" : n ?? "—"}</p>
              <p className="mt-1 text-sm uppercase text-vet-gray">
                {key === "daysSince" && !loading && !error && value === null
                  ? t.kpis.noAppointmentsYet
                  : t.kpis[key]}
              </p>
            </div>
            );
          })}
        </div>
        <nav aria-label={t.kpis.quickActions} className="grid gap-3">
          {ACTIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => openModal(id)}
              className="rounded-xl bg-white p-5 text-center text-lg uppercase shadow-sm transition-colors hover:bg-vet-lilac/40"
            >
              {t.screens[id]}
            </button>
          ))}
        </nav>
      </div>
      <section className={card}>
        <h2 className="text-2xl uppercase">{t.kpis.records}</h2>
        <p className="mt-2 text-vet-gray">{t.shell.comingSoon}</p>
      </section>
    </div>
  );
}
