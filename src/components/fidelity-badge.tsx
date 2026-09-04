"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Database, Network, Cloud, ChevronDown, Check, Loader2 } from "lucide-react";

type Fidelity = "mock" | "ontology" | "coa";

const CONFIG: Record<Fidelity, { label: string; title: string; blurb: string; className: string; dot: string; Icon: typeof Database }> = {
  mock: {
    label: "Demo data",
    title: "Mode 1 — SQLite seed data. Boots with no AWS.",
    blurb: "SQLite seed — the story, zero AWS",
    className: "text-zinc-400 border-white/[0.1] bg-white/[0.03]",
    dot: "bg-zinc-400",
    Icon: Database,
  },
  ontology: {
    label: "Local ontology",
    title: "Mode 2 — answers derived from the OWL ontology packs (transitive reasoning + governed metrics). Still no AWS.",
    blurb: "Real OWL reasoning + vector retrieval, no AWS",
    className: "text-indigo-300 border-indigo-700/40 bg-indigo-950/30",
    dot: "bg-indigo-400",
    Icon: Network,
  },
  coa: {
    label: "Live COA",
    title: "Mode 3 — resolved over a live Context Ontology Accelerator (Neptune + governed metrics).",
    blurb: "Neptune graph via COA, in your AWS account",
    className: "text-emerald-300 border-emerald-700/40 bg-emerald-950/30",
    dot: "bg-emerald-400",
    Icon: Cloud,
  },
};

const ORDER: Fidelity[] = ["mock", "ontology", "coa"];

/**
 * The honesty badge — now also the mode switcher. Always shows which fidelity is
 * live (so a demo can never silently look more real than it is), and lets you
 * climb the fidelity ladder at runtime without restarting the server. Switching
 * calls POST /api/mode and reloads so every page picks up the new provider.
 * See docs/RUNNING.md.
 */
export function FidelityBadge() {
  const [fidelity, setFidelity] = useState<Fidelity | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<Fidelity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/mode")
      .then((r) => r.json())
      .then((d) => setFidelity((d.mode as Fidelity) ?? (d.fidelity as Fidelity) ?? "mock"))
      .catch(() => setFidelity("mock"));
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function switchTo(mode: Fidelity) {
    if (mode === fidelity) { setOpen(false); return; }
    setSwitching(mode);
    setError(null);
    try {
      const res = await fetch("/api/mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? `Could not switch to ${mode}`);
        setSwitching(null);
        return;
      }
      // Reload so every component re-fetches through the new provider.
      window.location.reload();
    } catch (e: unknown) {
      setError((e as Error).message);
      setSwitching(null);
    }
  }

  if (!fidelity) return null;
  const active = CONFIG[fidelity] ?? CONFIG.mock;
  const { label, title, className, Icon } = active;

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen((o) => !o)}
        title={title}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium uppercase tracking-wider transition-colors hover:brightness-125",
          className
        )}
      >
        <Icon className="w-3 h-3" />
        {label}
        <ChevronDown className={cn("w-3 h-3 opacity-60 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-72 rounded-xl border border-white/[0.08] bg-[#111118] shadow-2xl z-50 p-1.5">
          <p className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
            Fidelity mode — climb the ladder
          </p>
          {ORDER.map((m) => {
            const c = CONFIG[m];
            const isActive = m === fidelity;
            const isSwitching = switching === m;
            return (
              <button
                key={m}
                onClick={() => switchTo(m)}
                disabled={switching !== null}
                className={cn(
                  "w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors disabled:opacity-60",
                  isActive ? "bg-white/[0.05]" : "hover:bg-white/[0.04]"
                )}
              >
                <span className={cn("mt-1 w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <c.Icon className="w-3 h-3 text-zinc-400" />
                    <span className="text-xs font-medium text-zinc-200">Mode {ORDER.indexOf(m) + 1} · {c.label}</span>
                    {isActive && <Check className="w-3 h-3 text-emerald-400 ml-auto" />}
                    {isSwitching && <Loader2 className="w-3 h-3 text-zinc-400 ml-auto animate-spin" />}
                  </span>
                  <span className="block text-[10px] text-zinc-500 mt-0.5 leading-snug">{c.blurb}</span>
                </span>
              </button>
            );
          })}
          {error && (
            <p className="px-2.5 py-1.5 text-[10px] text-red-400 leading-snug border-t border-white/[0.06] mt-1">
              {error}
            </p>
          )}
          <p className="px-2.5 py-1.5 text-[10px] text-zinc-600 leading-snug border-t border-white/[0.06] mt-1">
            Same UI, same question — only the fidelity of the answer changes. The page reloads on switch.
          </p>
        </div>
      )}
    </div>
  );
}
