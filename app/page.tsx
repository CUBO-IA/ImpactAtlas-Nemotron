import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  Bot,
  BrainCircuit,
  Database,
  FileText,
  GitCompare,
  LineChart,
  MapPin,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-900 selection:bg-orange-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="ImpactAtlas Logo"
              width={160}
              height={53}
              priority
              className="h-10 w-auto object-contain"
            />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-600 md:flex">
            <Link
              href="#explorador"
              className="transition-colors hover:text-[#002b7f]"
            >
              Explorador & Mapa
            </Link>
            <Link
              href="#comparador"
              className="transition-colors hover:text-[#002b7f]"
            >
              Comparador
            </Link>
            <Link
              href="#chat"
              className="transition-colors hover:text-[#002b7f]"
            >
              Asistente IA
            </Link>
            <Link
              href="#reportes"
              className="transition-colors hover:text-[#002b7f]"
            >
              Reportes PDF
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              50,000 Muestras Cargadas
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-zinc-100 bg-gradient-to-b from-blue-50/50 via-white to-white py-20 sm:py-28">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.blue.100),white)] opacity-40" />
          <div className="mx-auto max-w-7xl px-6 text-center sm:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/70 px-4 py-1.5 text-xs font-semibold text-[#002b7f] mb-8">
              <Sparkles className="size-3.5 text-orange-500" />
              <span>Plataforma de Análisis e Inclusión Financiera — El Salvador</span>
            </div>

            <div className="mx-auto flex justify-center mb-6">
              <Image
                src="/images/logo.png"
                alt="ImpactAtlas"
                width={360}
                height={120}
                priority
                className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
              />
            </div>

            <h1 className="mx-auto max-w-4xl text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-5xl sm:leading-tight">
              Mapeando las metas socioeconómicas y la{" "}
              <span className="text-[#ff6a00]">inclusión financiera</span> con IA
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600 sm:text-xl">
              Explora patrones demográficos, brechas de acceso bancario y aspiraciones
              de la población salvadoreña a través de visualizaciones interactivas, comparativas territoriales y búsqueda semántica con vectores.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#explorador"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#002b7f] px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#002060] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002b7f]"
              >
                <LineChart className="size-4" />
                Explorar Datos & Mapa
              </a>
              <a
                href="#chat"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-800 shadow-sm transition-all hover:border-zinc-400 hover:bg-zinc-50"
              >
                <Bot className="size-4 text-[#ff6a00]" />
                Consultar Asistente IA
              </a>
            </div>
          </div>
        </section>

        {/* Quick Stats Grid */}
        <section className="border-b border-zinc-200 bg-zinc-50/60 py-12">
          <div className="mx-auto max-w-7xl px-6 sm:px-8">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 text-center shadow-xs">
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#002b7f]">
                  <Users className="size-5" />
                </div>
                <div className="text-3xl font-bold tracking-tight text-zinc-950">50,000</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Perfiles Analizados
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 text-center shadow-xs">
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-orange-50 text-[#ff6a00]">
                  <MapPin className="size-5" />
                </div>
                <div className="text-3xl font-bold tracking-tight text-zinc-950">14</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Departamentos Cubiertos
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 text-center shadow-xs">
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#002b7f]">
                  <Database className="size-5" />
                </div>
                <div className="text-3xl font-bold tracking-tight text-zinc-950">768</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Dimensiones Vectoriales
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 text-center shadow-xs">
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-orange-50 text-[#ff6a00]">
                  <Wallet className="size-5" />
                </div>
                <div className="text-3xl font-bold tracking-tight text-zinc-950">pgvector</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Búsqueda Semántica
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4 Core Features / MVP Modules */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#ff6a00]">
                  Funcionalidades del MVP
                </span>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
                  Las Cuatro Áreas de ImpactAtlas
                </h2>
              </div>
              <p className="mt-4 max-w-md text-sm text-zinc-600 md:mt-0">
                Diseñadas para explorar con rigor estadístico y responder con precisión a preguntas de política pública e inclusión social.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              {/* Function 1: Explorador */}
              <div id="explorador" className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs transition-all hover:border-blue-300 hover:shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-[#002b7f] transition-transform group-hover:scale-105">
                    <BarChart3 className="size-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-zinc-950">
                    1. Explorador y Mapa
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                    Mapeo coroplético interactivo de los 14 departamentos con MapLibre. Filtros por ingresos, educación y ocupación con panel de distribuciones ECharts.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-[#002b7f]">
                  <span>Fase 2 (D1-04 a D1-06)</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>

              {/* Function 2: Comparador */}
              <div id="comparador" className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs transition-all hover:border-orange-300 hover:shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-orange-50 text-[#ff6a00] transition-transform group-hover:scale-105">
                    <GitCompare className="size-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-zinc-950">
                    2. Comparador
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                    Comparación simultánea de 2 a 14 departamentos con un territorio de referencia. Tablas y gráficos de brechas en ingresos y exclusión financiera.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-[#ff6a00]">
                  <span>Fase 3 (D1-07 a D1-09)</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>

              {/* Function 3: Chat */}
              <div id="chat" className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs transition-all hover:border-blue-300 hover:shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-[#002b7f] transition-transform group-hover:scale-105">
                    <Bot className="size-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-zinc-950">
                    3. Chat & Asistente IA
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                    Consultas conversacionales en español con herramientas SQL controladas y búsqueda semántica de metas en vectores de 768 dimensiones.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-[#002b7f]">
                  <span>Fase 4 (D1-10 a D1-12)</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>

              {/* Function 4: Reportes */}
              <div id="reportes" className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs transition-all hover:border-orange-300 hover:shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-orange-50 text-[#ff6a00] transition-transform group-hover:scale-105">
                    <FileText className="size-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-zinc-950">
                    4. Reportes PDF
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                    Configuración de secciones, indicadores y descarga de reportes ejecutivos en PDF generados con fuentes, notas metodológicas y limitaciones claras.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-[#ff6a00]">
                  <span>Fase 5 (D1-13 a D1-15)</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Architecture Overview */}
        <section className="border-t border-zinc-200 bg-zinc-50/70 py-16">
          <div className="mx-auto max-w-7xl px-6 sm:px-8">
            <div className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-12 shadow-sm">
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#002b7f]">
                    <BrainCircuit className="size-3.5" />
                    Arquitectura de Datos y Visualización
                  </div>
                  <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950">
                    Principios de Visualización Responsable
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-600">
                    El proyecto separa con rigor el cálculo estadístico exhaustivo de los ejemplos semánticos para evitar sesgos de representatividad:
                  </p>
                  <ul className="mt-6 space-y-3 text-xs sm:text-sm text-zinc-700">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#002b7f]" />
                      <span><strong>Cálculos exactos en SQL:</strong> Todos los promedios, porcentajes y totales se calculan sobre la totalidad de la muestra filtrada.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#ff6a00]" />
                      <span><strong>Búsqueda vectorial contextual:</strong> Los vectores en pgvector se utilizan para encontrar ejemplos cualitativos afines, nunca para extrapolar conteos.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#002b7f]" />
                      <span><strong>Protección y supresión:</strong> Reglas claras para alertar sobre submuestras pequeñas y evitar conclusiones apresuradas.</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-inner">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-zinc-800">Estado del Sistema Local</span>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">Postgres 17 + pgvector</span>
                  </div>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="rounded-lg bg-white p-2.5 border border-zinc-200 flex justify-between">
                      <span className="text-zinc-500">Dataset snapshot:</span>
                      <span className="text-zinc-900 font-semibold">50,000 registros restaurados</span>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-zinc-200 flex justify-between">
                      <span className="text-zinc-500">Vector Embeddings:</span>
                      <span className="text-zinc-900 font-semibold">50,000 / 768 dims (OK)</span>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-zinc-200 flex justify-between">
                      <span className="text-zinc-500">Esquemas Zod (src/contracts):</span>
                      <span className="text-emerald-600 font-semibold">4 tests pasados</span>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-zinc-200 flex justify-between">
                      <span className="text-zinc-500">Next.js App Router:</span>
                      <span className="text-emerald-600 font-semibold">Listo en http://localhost:3000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-zinc-500 sm:flex-row sm:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="ImpactAtlas"
              width={120}
              height={40}
              className="h-7 w-auto object-contain opacity-80"
            />
            <span className="text-xs text-zinc-400">|</span>
            <span className="text-xs text-zinc-500">ImpactAtlas — Equipo CUBO-IA</span>
          </div>
          <p className="text-xs text-zinc-400">
            Developer 1: Frontend & Visualización • Next.js 16 • Tailwind CSS v4
          </p>
        </div>
      </footer>
    </div>
  );
}
