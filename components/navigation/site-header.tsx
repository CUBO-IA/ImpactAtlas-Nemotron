"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Compass,
  GitCompare,
  Bot,
  FileText,
  ArrowRight,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/explorador", label: "Explorador y Mapa", icon: Compass },
  { href: "/comparador", label: "Comparador", icon: GitCompare },
  { href: "/chat", label: "Asistente IA", icon: Bot },
  { href: "/reportes", label: "Reportes PDF", icon: FileText },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200/70 bg-white/80 backdrop-blur-xl transition-all duration-300 shadow-[0_4px_20px_-4px_rgba(0,43,127,0.05)]">
      {/* Top micro-line gradient for futuristic look */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#002b7f]/60 to-[#ff6a00]/60 opacity-80" />

      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 sm:px-8">
        {/* Brand & Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-center gap-3 transition-transform duration-200 hover:scale-[1.02]">
            <div className="relative">
              <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-[#002b7f]/20 to-[#ff6a00]/20 opacity-0 blur-sm transition duration-300 group-hover:opacity-100" />
              <Image
                src="/images/logo.svg"
                alt="ImpactAtlas Logo"
                width={150}
                height={50}
                priority
                unoptimized
                className="relative h-9 w-auto object-contain"
              />
            </div>
          </Link>

          {/* Telemetry Chip */}
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-zinc-200/80 bg-zinc-50/80 px-3 py-1 text-[11px] font-mono text-zinc-600 shadow-2xs">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-semibold tracking-wider text-zinc-700">ANÁLISIS DE DATOS</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl border border-zinc-200/60 bg-zinc-50/70 shadow-2xs">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-white text-[#002b7f] shadow-xs ring-1 ring-zinc-950/5"
                    : "text-zinc-600 hover:text-zinc-950 hover:bg-white/60"
                }`}
              >
                <Icon className={`size-3.5 transition-colors ${isActive ? "text-[#ff6a00]" : "text-zinc-400"}`} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 size-1 rounded-full bg-[#002b7f]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="/explorador"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#002b7f] to-[#001d54] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-[#002b7f]/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <Compass className="size-3.5 text-orange-400 transition-transform duration-300 group-hover:rotate-45" />
            <span>Explorador GIS</span>
            <ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-0.5 text-zinc-300" />
          </Link>
        </div>
      </div>
    </header>
  );
}
