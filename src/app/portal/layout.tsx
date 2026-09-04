"use client";
import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[120px] opacity-[0.04] bg-amber-500" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl px-4 md:px-6 py-3 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-base font-bold text-white">PowerView</div>
            <div className="text-[10px] text-zinc-500 -mt-0.5">Outage Status Portal</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/console/graph"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Operator Console
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-[11px] font-bold text-white">JD</div>
            <div className="hidden sm:block">
              <div className="text-xs text-zinc-200">John Doe</div>
              <div className="text-[10px] text-zinc-500">Acct #4471-2201</div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {children}
      </main>
    </div>
  );
}
