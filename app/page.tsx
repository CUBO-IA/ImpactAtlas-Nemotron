import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  Bot,
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
              href="/explorador"
              className="text-[#002b7f] font-semibold transition-colors hover:text-[#002060]"
            >
              Explorador y Mapa
            </Link>
            <Link
              href="/comparador"
              className="transition-colors hover:text-[#002b7f]"
            >
              Comparador
            </Link>
            <Link
              href="/chat"
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
            <Link
              href="/explorador"
              className="inline-flex items-center gap-2 rounded-xl bg-[#002b7f] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#002060]"
            >
              <LineChart className="size-3.5" />
              Abrir Explorador
            </Link>
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
              <Link
                href="/explorador"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#002b7f] px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#002060] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002b7f]"
              >
                <LineChart className="size-4" />
                Abrir Explorador y Mapa
              </Link>
              <a
              href="/chat"
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
                <div className="text-3xl font-bold tracking-tight text-zinc-950">Variable</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Registros por filtro
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
                  Capacidades de la Plataforma
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
              <Link
                href="/explorador"
                className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs transition-all hover:border-blue-400 hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-[#002b7f] transition-transform group-hover:scale-105">
                    <BarChart3 className="size-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-zinc-950 group-hover:text-[#002b7f] transition-colors">
                    1. Explorador y Mapa
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                    Mapeo coroplético interactivo de los 14 departamentos. Filtros por ingresos, educación y ocupación con panel de distribuciones y estadísticas en tiempo real.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-[#002b7f]">
                  <span>Abrir mapa interactivo</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>

              {/* Function 2: Comparador */}
              <Link
                href="/comparador"
                className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs transition-all hover:border-orange-400 hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-orange-50 text-[#ff6a00] transition-transform group-hover:scale-105">
                    <GitCompare className="size-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-zinc-950 group-hover:text-[#ff6a00] transition-colors">
                    2. Comparador
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                    Comparación simultánea de 2 a 14 departamentos con un territorio de referencia. Tablas y gráficos de brechas en ingresos y exclusión financiera.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-[#ff6a00]">
                  <span>Abrir comparador</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>

              {/* Function 3: Chat */}
              <Link href="/chat" className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs transition-all hover:border-blue-300 hover:shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-[#002b7f] transition-transform group-hover:scale-105">
                    <Bot className="size-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-zinc-950">
                    3. Chat & Asistente IA
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                    Consultas conversacionales sobre el catálogo disponible, con respuestas sujetas a las capacidades actuales del asistente.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-[#002b7f]">
                  <span>Consultas en lenguaje natural</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>

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
                  <span>Exportación ejecutiva</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Methodological Responsibility Section */}
        <section className="border-t border-zinc-200 bg-zinc-50/70 py-16">
          <div className="mx-auto max-w-7xl px-6 sm:px-8">
            <div className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-12 shadow-sm">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#002b7f]">
                  <TrendingUp className="size-3.5" />
                  Principios Metodológicos y Estadísticos
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950">
                  Transparencia y Precisión Analítica
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-zinc-600">
                  ImpactAtlas separa con rigor el cálculo estadístico exhaustivo de los ejemplos semánticos para garantizar conclusiones confiables:
                </p>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <h4 className="font-semibold text-xs text-[#002b7f] uppercase tracking-wide">Cálculos Exactos</h4>
                    <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
                      Medias, medianas y tasas calculadas directamente en PostgreSQL sobre todos los registros filtrados.
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <h4 className="font-semibold text-xs text-[#ff6a00] uppercase tracking-wide">Búsqueda Semántica</h4>
                    <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
                      Embeddings vectoriales de 768 dimensiones para encontrar metas cualitativas afines sin alterar promedios.
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <h4 className="font-semibold text-xs text-[#002b7f] uppercase tracking-wide">Protección de Datos</h4>
                    <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
                      Supresión automática de privacidad cuando una subcohorte contiene menos de 5 observaciones.
                    </p>
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
            <span className="text-xs text-zinc-500">ImpactAtlas — Plataforma de Inclusión Financiera</span>
          </div>
          <p className="text-xs text-zinc-400">
            El Salvador • Análisis Socioeconómico y Visualización con Inteligencia Artificial
          </p>
        </div>
      </footer>
    </div>
  );
}
