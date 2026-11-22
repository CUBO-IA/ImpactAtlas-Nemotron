"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  if (education) filters.educationIds = education.split(",");
  if (occupation) filters.occupationIds = occupation.split(",");
  if (goals) filters.goalIds = goals.split(",");
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
    const search = query.toString();
    router.replace(search ? `/reportes?${search}` : "/reportes", { scroll: false });
  }, [filters, router]);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <nav className="flex gap-5 text-sm">
          <Link href="/" className="font-semibold text-blue-900">ImpactAtlas</Link>
          <Link href="/explorador">Explorador</Link>
          <Link href="/comparador">Comparador</Link>
          <Link href="/chat">Chat</Link>
        </nav>
        <header>
          <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Reportes PDF</p>
          <h1 className="mt-2 text-3xl font-bold">Configurar reporte estadístico</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600">
            El reporte usa el catálogo auditado y los datos disponibles. Ingresos estimados; la muestra no necesariamente representa a El Salvador.
          </p>
        </header>
        <ReportConfigurator filters={filters} onChangeFilters={setFilters} />
      </div>
    </main>
  );
}

export default function ReportesPage() {
  return <Suspense fallback={<p>Cargando reportes…</p>}><ReportesContent /></Suspense>;
}
