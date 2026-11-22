import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/navigation/site-header";
import { SiteFooter } from "@/components/navigation/site-footer";
import {
  Compass,
  GitCompare,
  Bot,
  FileText,
  Database,
  Users,
  MapPin,
  Cpu,
  ArrowRight,
  Layers,
  Activity,
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-900 selection:bg-[#ff6a00] selection:text-white relative overflow-x-hidden">
      {/* Futuristic Navigation */}
      <SiteHeader />

      <main className="flex-1">
        {/* Hero Section with Ambient Glow and Cyber Grid */}
        <section className="relative overflow-hidden border-b border-zinc-200/70 bg-gradient-to-b from-blue-50/40 via-white to-zinc-50/50 py-24 sm:py-32">
          {/* Subtle Ambient Glowing Orbs */}
          <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-[#002b7f]/15 to-[#ff6a00]/15 blur-3xl opacity-60 rounded-full" />
          <div className="pointer-events-none absolute top-1/2 -right-32 w-96 h-96 bg-[#ff6a00]/10 blur-3xl rounded-full" />
          <div className="pointer-events-none absolute top-1/3 -left-32 w-96 h-96 bg-[#002b7f]/10 blur-3xl rounded-full" />

          {/* Tech Grid Background Pattern */}
          <div className="absolute inset-0 bg-tech-grid opacity-60 pointer-events-none" />

          <div className="relative mx-auto max-w-7xl px-6 text-center sm:px-8">
            {/* Telemetry Status Badge */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-200/70 bg-white/80 backdrop-blur-md px-4 py-1.5 text-xs font-semibold text-[#002b7f] shadow-xs mb-8 animate-float-slow">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6a00] opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-[#ff6a00]" />
              </span>
              <span className="font-mono uppercase tracking-wider text-[11px] text-zinc-700">
                Inteligencia Geoespacial & Analítica Vectorial · El Salvador
              </span>
            </div>

            {/* Platform Brand Hero Display */}
            <div className="mx-auto flex justify-center mb-8">
              <div className="relative p-2 rounded-3xl bg-white/60 backdrop-blur-lg border border-zinc-200/60 shadow-[0_8px_30px_rgb(0,43,127,0.08)]">
                <Image
                  src="/images/logo.svg"
                  alt="ImpactAtlas"
                  width={360}
                  height={120}
                  priority
                  unoptimized
                  className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
                />
              </div>
            </div>

            <h1 className="mx-auto max-w-4xl text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-5xl sm:leading-tight">
              Mapeando las metas socioeconómicas y la{" "}
              <span className="futuristic-gradient-text">inclusión financiera</span> con IA
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg">
              Explora patrones demográficos, brechas territoriales y aspiraciones
              de la población salvadoreña a través de cartografía coroplética interactiva, comparativas de precisión y consultas asistidas por el modelo local Qwen3.5.
            </p>

            {/* Action Buttons with Micro-interactions */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/explorador"
                className="group relative inline-flex h-12 items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#002b7f] to-[#001d54] px-7 text-sm font-semibold text-white shadow-md shadow-[#002b7f]/20 transition-all duration-300 hover:shadow-lg hover:shadow-[#002b7f]/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Compass className="size-4 text-orange-400 transition-transform duration-300 group-hover:rotate-45" />
                <span>Abrir Explorador y Mapa</span>
                <ArrowRight className="size-4 text-zinc-300 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/chat"
                className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-xl border border-zinc-300/80 bg-white/90 backdrop-blur-md px-7 text-sm font-semibold text-zinc-800 shadow-xs transition-all duration-200 hover:border-[#002b7f]/40 hover:bg-zinc-50 hover:text-[#002b7f] hover:shadow-sm"
              >
                <Bot className="size-4 text-[#ff6a00] transition-transform duration-200 group-hover:scale-110" />
                <span>Consultar Asistente IA</span>
              </Link>
            </div>
          </div>
        </section>

        {/* High-Tech Telemetry Stats Grid */}
        <section className="relative border-b border-zinc-200/80 bg-zinc-50/70 py-12">
          <div className="absolute inset-0 bg-tech-dots opacity-30 pointer-events-none" />
          <div className="relative mx-auto max-w-7xl px-6 sm:px-8">
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
              <div className="glass-card-interactive hud-bracket rounded-2xl p-6 text-center">
                <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-blue-50 text-[#002b7f] shadow-2xs">
                  <Users className="size-5" />
                </div>
                <div className="text-3xl font-mono font-bold tracking-tight text-zinc-950">Variable</div>
                <div className="mt-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  Registros por filtro
                </div>
              </div>

              <div className="glass-card-interactive hud-bracket rounded-2xl p-6 text-center">
                <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-orange-50 text-[#ff6a00] shadow-2xs">
                  <MapPin className="size-5" />
                </div>
                <div className="text-3xl font-mono font-bold tracking-tight text-zinc-950">14</div>
                <div className="mt-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  Departamentos Cubiertos
                </div>
              </div>

              <div className="glass-card-interactive hud-bracket rounded-2xl p-6 text-center">
                <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-blue-50 text-[#002b7f] shadow-2xs">
                  <Database className="size-5" />
                </div>
                <div className="text-3xl font-mono font-bold tracking-tight text-zinc-950">Qwen3.5</div>
                <div className="mt-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  Modelo local
                </div>
              </div>

              <div className="glass-card-interactive hud-bracket rounded-2xl p-6 text-center">
                <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-orange-50 text-[#ff6a00] shadow-2xs">
                  <Cpu className="size-5" />
                </div>
                <div className="text-3xl font-mono font-bold tracking-tight text-zinc-950">Local</div>
                <div className="mt-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  Asistente PoC
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4 Core Features / Futuristic Modules Grid */}
        <section className="relative py-20 sm:py-28 bg-white overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 sm:px-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-14">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-widest text-[#ff6a00] mb-2">
                  <Layers className="size-3.5" />
                  <span>Capacidades de la Plataforma</span>
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
                  Las Cuatro Áreas de ImpactAtlas
                </h2>
              </div>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-600 md:mt-0">
                Diseñadas para explorar con rigor estadístico y responder con precisión a preguntas estratégicas de política pública e inclusión social.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Module 1: Explorador */}
              <Link
                href="/explorador"
                className="group glass-card-interactive rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden"
              >
                <div className="h-1 w-full bg-gradient-to-r from-[#002b7f] to-blue-400 absolute top-0 left-0" />
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-[#002b7f] shadow-2xs transition-transform duration-300 group-hover:scale-110">
                    <Compass className="size-6" />
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#002b7f]">F-01</span>
                    <span className="text-xs text-zinc-400">·</span>
                    <span className="text-xs font-medium text-zinc-500">Cartografía GIS</span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-zinc-950 group-hover:text-[#002b7f] transition-colors">
                    Explorador y Mapa
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

              {/* Module 2: Comparador */}
              <Link
                href="/comparador"
                className="group glass-card-interactive rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden"
              >
                <div className="h-1 w-full bg-gradient-to-r from-[#ff6a00] to-amber-400 absolute top-0 left-0" />
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-orange-50 text-[#ff6a00] shadow-2xs transition-transform duration-300 group-hover:scale-110">
                    <GitCompare className="size-6" />
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#ff6a00]">F-02</span>
                    <span className="text-xs text-zinc-400">·</span>
                    <span className="text-xs font-medium text-zinc-500">Matriz Territorial</span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-zinc-950 group-hover:text-[#ff6a00] transition-colors">
                    Comparador
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                    Comparación simultánea de 2 a 14 departamentos con territorio de referencia. Tablas de brechas en ingresos y exclusión en puntos porcentuales exactos.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-[#ff6a00]">
                  <span>Abrir comparador</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>

              {/* Module 3: Chat */}
              <Link
                href="/chat"
                className="group glass-card-interactive rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden"
              >
                <div className="h-1 w-full bg-gradient-to-r from-[#002b7f] to-indigo-500 absolute top-0 left-0" />
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-[#002b7f] shadow-2xs transition-transform duration-300 group-hover:scale-110">
                    <Bot className="size-6" />
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#002b7f]">F-03</span>
                    <span className="text-xs text-zinc-400">·</span>
                    <span className="text-xs font-medium text-zinc-500">Asistente Neural</span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-zinc-950 group-hover:text-[#002b7f] transition-colors">
                    Chat & Asistente IA
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                    Consultas conversacionales con el modelo local Qwen3.5 sobre la información disponible.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-[#002b7f]">
                  <span>Abrir asistente</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>

              {/* Module 4: Reportes */}
              <Link
                href="/reportes"
                className="group glass-card-interactive rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden"
              >
                <div className="h-1 w-full bg-gradient-to-r from-[#ff6a00] to-rose-400 absolute top-0 left-0" />
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-orange-50 text-[#ff6a00] shadow-2xs transition-transform duration-300 group-hover:scale-110">
                    <FileText className="size-6" />
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#ff6a00]">F-04</span>
                    <span className="text-xs text-zinc-400">·</span>
                    <span className="text-xs font-medium text-zinc-500">Descarga PDF</span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-zinc-950 group-hover:text-[#ff6a00] transition-colors">
                    Reportes PDF
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                    Configuración de secciones, indicadores y descarga de reportes ejecutivos generados en el servidor con fuentes CNR, gráficos SSR y notas metodológicas.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-[#ff6a00]">
                  <span>Configurar y descargar</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Methodological Transparency Section */}
        <section className="border-t border-zinc-200/80 bg-zinc-50/60 py-20 relative">
          <div className="absolute inset-0 bg-tech-grid opacity-30 pointer-events-none" />
          <div className="relative mx-auto max-w-7xl px-6 sm:px-8">
            <div className="glass-surface hud-bracket rounded-3xl p-8 sm:p-12">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#002b7f]">
                  <Activity className="size-3.5 text-[#ff6a00]" />
                  <span>Principios Metodológicos y Estadísticos</span>
                </div>
                <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
                  Transparencia y Precisión Analítica de Extremo a Extremo
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                  ImpactAtlas separa con rigor el cálculo estadístico exhaustivo de los ejemplos semánticos para garantizar conclusiones confiables:
                </p>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-2xs hover:border-[#002b7f]/30 transition-colors">
                    <div className="font-mono text-xs font-bold text-[#002b7f] uppercase tracking-wider">Cálculos Exactos</div>
                    <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
                      Las métricas dependen de los datos y filtros disponibles en esta prueba de concepto.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-2xs hover:border-[#ff6a00]/30 transition-colors">
                    <div className="font-mono text-xs font-bold text-[#ff6a00] uppercase tracking-wider">Búsqueda Semántica</div>
                    <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
                      El asistente local ayuda a explorar la información disponible; sus respuestas pueden ser incompletas.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-2xs hover:border-[#002b7f]/30 transition-colors">
                    <div className="font-mono text-xs font-bold text-[#002b7f] uppercase tracking-wider">Protección de Datos</div>
                    <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
                      Supresión automática de privacidad cuando una subcohorte contiene menos de 5 observaciones ($n &lt; 5$).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Unified Footer */}
      <SiteFooter />
    </div>
  );
}
