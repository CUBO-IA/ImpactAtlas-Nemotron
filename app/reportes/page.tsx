"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/navigation/site-header";
import { SiteFooter } from "@/components/navigation/site-footer";
import { departmentIdSchema, type Filters } from "@/src/contracts/common";
import { ReportConfigurator } from "@/components/reports/report-configurator";

function readFilters(params: URLSearchParams): Filters {
  const filters: Filters = {};
  const departments = params.get("depts") ?? params.get("departmentIds") ?? params.get("dept");
  const education = params.get("education") ?? params.get("educationIds");
  const occupation = params.get("occupation") ?? params.get("occupationIds");
  const goals = params.get("goal") ?? params.get("goalIds");
  const min = params.get("minIncome");
  const max = params.get("maxIncome");
  if (departments) filters.departmentIds = departments.split(",").filter((id) => departmentIdSchema.safeParse(id).success) as NonNullable<Filters["departmentIds"]>;
  if (education) filters.educationIds = education.split(",").filter(Boolean);
  if (occupation) filters.occupationIds = occupation.split(",").filter(Boolean);
  if (goals) filters.goalIds = goals.split(",").filter(Boolean);
  if (min || max) filters.income = { min: min ? Number(min) : undefined, max: max ? Number(max) : undefined };
  return filters;
}

function ReportesContent() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = useMemo(() => readFilters(new URLSearchParams(params.toString())), [params]);
  const [filters, setFilters] = useState<Filters>(initial);

  useEffect(() => {
    const query = new URLSearchParams();
    if (filters.departmentIds?.length) query.set("depts", filters.departmentIds.join(","));
    if (filters.educationIds?.length) query.set("education", filters.educationIds.join(","));
    if (filters.occupationIds?.length) query.set("occupation", filters.occupationIds.join(","));
    if (filters.goalIds?.length) query.set("goal", filters.goalIds.join(","));
    if (filters.income?.min !== undefined) query.set("minIncome", String(filters.income.min));
    if (filters.income?.max !== undefined) query.set("maxIncome", String(filters.income.max));
    const targetSearch = query.toString() ? `?${query}` : "";
    if (window.location.search !== targetSearch) router.replace(`/reportes${targetSearch}`, { scroll: false });
  }, [filters, router]);

  return (
    <div className="relative flex min-h-screen flex-col bg-white font-sans text-zinc-900 selection:bg-[#ff6a00] selection:text-white">
      <SiteHeader />
      <main className="relative mx-auto w-full max-w-6xl flex-1 space-y-8 px-5 py-8 sm:px-8 sm:py-12">
        <div className="pointer-events-none absolute inset-0 bg-tech-dots opacity-30" />
        <header className="relative border-b border-zinc-200 pb-7">
          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#002b7f]">ImpactAtlas / Reportes</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">Datos listos para compartir.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
            Crea un reporte PDF con los filtros, indicadores y secciones que necesitas. La muestra no necesariamente representa a El Salvador.
          </p>
        </header>
        <ReportConfigurator filters={filters} onChangeFilters={setFilters} />
      </main>
      <SiteFooter />
    </div>
  );
}

export default function ReportesPage() {
  return <Suspense fallback={<p>Cargando reportes…</p>}><ReportesContent /></Suspense>;
}
