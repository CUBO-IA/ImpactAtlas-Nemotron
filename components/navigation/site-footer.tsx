import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Database, Cpu, Compass } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="relative border-t border-zinc-200/80 bg-white/90 backdrop-blur-md overflow-hidden text-zinc-600">
      {/* Micro tech grid background on footer */}
      <div className="absolute inset-0 bg-tech-dots opacity-40 pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 sm:px-8 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 border-b border-zinc-200/60 pb-8">
          <div className="space-y-3 max-w-md">
            <Link href="/" className="inline-block">
              <Image
                src="/images/logo.svg"
                alt="ImpactAtlas Logo"
                width={140}
                height={47}
                unoptimized
                className="h-8 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
              />
            </Link>
            <p className="text-xs leading-relaxed text-zinc-500">
              Plataforma de inteligencia geoespacial, inclusión financiera y analítica predictiva sobre microdatos socioeconómicos de El Salvador.
            </p>
          </div>

          {/* Quick Technical Specs Pill */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                <Database className="size-3 text-[#002b7f]" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Base Vectorial</span>
              </div>
              <div className="font-semibold text-zinc-900">pgvector · 768d</div>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                <ShieldCheck className="size-3 text-[#ff6a00]" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Privacidad</span>
              </div>
              <div className="font-semibold text-zinc-900">Supresión n &lt; 5</div>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                <Cpu className="size-3 text-emerald-600" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Muestreo</span>
              </div>
              <div className="font-semibold text-zinc-900">50,000 Perfiles</div>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-700">ImpactAtlas</span>
            <span>·</span>
            <span>Inteligencia de Datos para El Salvador</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/explorador" className="hover:text-[#002b7f] transition-colors">
              Explorador
            </Link>
            <Link href="/comparador" className="hover:text-[#002b7f] transition-colors">
              Comparador
            </Link>
            <Link href="/chat" className="hover:text-[#002b7f] transition-colors">
              Asistente IA
            </Link>
            <Link href="/reportes" className="hover:text-[#002b7f] transition-colors">
              Reportes PDF
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
