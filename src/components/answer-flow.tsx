"use client";
/**
 * AnswerFlow — a live, animated indicator of how the current answer is produced:
 * Question → (Vector ‖ Graph retrieval) → Synthesize.
 *
 * While a query runs the path pulses with flowing dots. When results land, each
 * retrieval path is marked by its ACTUAL contribution:
 *   - used   (indigo check + count) = returned data that grounds the answer
 *   - unused (dim, "0")             = returned nothing → not used (normal)
 *   - error  (red, "error")         = the path failed (e.g. COA 403/404)
 * Everything carries a tooltip (hover) so the pipeline is self-explanatory.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, Database, Share2, Sparkles, Check, X, Play, AlertTriangle } from "lucide-react";

export type PathState = "idle" | "running" | "used" | "unused" | "error";

interface PathInput {
  hasResult: boolean;
  count: number;
  /** Unit for the count, e.g. "chunks" (vector) or "docs" (graph). */
  unit: string;
  /** Did this path actually produce content that grounds the answer? */
  contributed: boolean;
  errored: boolean;
  /** Backend that served this path, shown in the tooltip. */
  backend?: string;
}

function statusFor(opts: { running: boolean } & PathInput): PathState {
  if (opts.errored) return "error";
  if (opts.running) return "running";
  if (!opts.hasResult) return "idle";
  return opts.contributed ? "used" : "unused";
}

export function AnswerFlow({
  running,
  vector,
  graph,
}: {
  running: boolean;
  vector: PathInput;
  graph: PathInput;
}) {
  // Replay: briefly re-run the flow animation over the SAME results so you can
  // re-explain how the answer formed, without re-querying.
  const [replaying, setReplaying] = useState(false);
  const replay = () => {
    setReplaying(true);
    setTimeout(() => setReplaying(false), 2600);
  };

  const animating = running || replaying;
  const vState = statusFor({ running: animating, ...vector });
  const gState = statusFor({ running: animating, ...graph });
  const done = !running && (vector.hasResult || graph.hasResult || vector.errored || graph.errored);

  // Did anything ground the answer? Drives the Synthesize node's final state.
  const anyUsed = vState === "used" || gState === "used";
  const anyError = vState === "error" || gState === "error";
  const synthTone: NodeTone = animating ? "running" : done ? (anyUsed ? "done" : anyError ? "error" : "warn") : "neutral";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-medium text-zinc-300">
            {animating ? "Generating answer…" : done ? "How this answer was formed" : "Answer pipeline"}
          </span>
          <span className="text-[10px] text-zinc-600 hidden sm:inline">· 2 retrieval methods → 1 model writes the grounded answer</span>
        </div>
        {done && (
          <button
            onClick={replay}
            disabled={replaying}
            className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-md border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-50 text-[11px] text-zinc-300 transition-colors"
          >
            <Play className="w-3 h-3" /> {replaying ? "Playing…" : "Replay"}
          </button>
        )}
      </div>

      <div className="flex items-stretch gap-2">
        {/* Question */}
        <Node
          icon={<FileText className="w-4 h-4" />}
          label="Question"
          sub="your query"
          tone={animating ? "running" : "neutral"}
          tip="Your question is sent to BOTH retrieval paths in parallel, then a model writes the answer from whatever they return."
        />

        <Connector active={animating} />

        {/* Retrieve: two parallel paths */}
        <div className="flex flex-col gap-2 justify-center">
          <PathNode
            icon={<Database className="w-4 h-4" />}
            label="Vector RAG"
            sub="similar text chunks"
            state={vState}
            count={vector.count}
            unit={vector.unit}
            tip={`Embeds your question and finds the most similar document chunks (cosine similarity).${vector.backend ? ` Backend: ${vector.backend}.` : ""}`}
          />
          <PathNode
            icon={<Share2 className="w-4 h-4" />}
            label="GraphRAG"
            sub="connected facts"
            state={gState}
            count={graph.count}
            unit={graph.unit}
            accent
            tip={`Walks the knowledge graph from entities in your question to find connected facts across documents.${graph.backend ? ` Backend: ${graph.backend}.` : ""}`}
          />
        </div>

        <Connector active={animating} />

        {/* Synthesize */}
        <Node
          icon={<Sparkles className="w-4 h-4" />}
          label="Synthesize"
          sub={done && !anyUsed ? "no grounding" : "model via Bedrock"}
          tone={synthTone}
          tip="A model (via Amazon Bedrock) writes the answer using ONLY what the retrieval paths returned. If nothing was retrieved, it says it can't answer rather than guessing."
        />
      </div>

      {done && !replaying && (
        <p className="text-[11px] text-zinc-500 mt-3 leading-snug">
          {legend(vState, gState, vector, graph)}
        </p>
      )}
    </div>
  );
}

function legend(v: PathState, g: PathState, vi: PathInput, gi: PathInput): string {
  const used: string[] = [];
  if (v === "used") used.push(`Vector (${vi.count} ${vi.unit})`);
  if (g === "used") used.push(`Graph (${gi.count} ${gi.unit})`);
  const notes: string[] = [];
  if (v === "error") notes.push("Vector errored");
  else if (v === "unused") notes.push("Vector found nothing");
  if (g === "error") notes.push("Graph errored");
  else if (g === "unused") notes.push("Graph found nothing");

  const parts: string[] = [];
  if (used.length) parts.push(`Grounded by: ${used.join(" + ")}.`);
  if (notes.length) parts.push(`${notes.join("; ")} — so ${notes.length > 1 ? "those paths were" : "that path was"} not used.`);
  if (!used.length) return "No sources returned — the model reports it can't answer rather than guessing. Check the mode/vertical has data.";
  return parts.join(" ");
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="relative flex items-center min-w-[36px] flex-1">
      <div className="h-px w-full bg-white/[0.12]" />
      {active && (
        <>
          <span className="absolute left-0 h-1.5 w-1.5 rounded-full bg-indigo-400 animate-flow-dot" />
          <span className="absolute left-0 h-1.5 w-1.5 rounded-full bg-indigo-400 animate-flow-dot [animation-delay:0.5s]" />
        </>
      )}
    </div>
  );
}

type NodeTone = "neutral" | "running" | "done" | "warn" | "error";

function Node({
  icon,
  label,
  sub,
  tone,
  tip,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  tone: NodeTone;
  tip?: string;
}) {
  return (
    <div
      title={tip}
      className={cn(
        "rounded-lg border px-3 py-2 min-w-[118px] flex flex-col justify-center cursor-help transition-colors",
        tone === "running" && "border-indigo-500/40 bg-indigo-950/20 animate-pulse",
        tone === "done" && "border-emerald-500/30 bg-emerald-950/10",
        tone === "warn" && "border-amber-500/30 bg-amber-950/[0.08]",
        tone === "error" && "border-red-500/40 bg-red-950/10",
        tone === "neutral" && "border-white/[0.08] bg-black/20"
      )}
    >
      <div className={cn("flex items-center gap-1.5", tone === "warn" ? "text-amber-200/90" : tone === "error" ? "text-red-300" : "text-zinc-300")}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className={cn("text-[10px] mt-0.5", tone === "warn" ? "text-amber-300/70" : tone === "error" ? "text-red-400/70" : "text-zinc-500")}>{sub}</span>
    </div>
  );
}

function PathNode({
  icon,
  label,
  sub,
  state,
  count,
  unit,
  accent,
  tip,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  state: PathState;
  count: number;
  unit: string;
  accent?: boolean;
  tip?: string;
}) {
  const border =
    state === "used"
      ? "border-indigo-400/50 bg-indigo-950/25"
      : state === "error"
      ? "border-red-500/40 bg-red-950/10"
      : state === "unused"
      ? "border-white/[0.06] bg-black/20 opacity-55"
      : state === "running"
      ? cn("animate-pulse", accent ? "border-indigo-500/40 bg-indigo-950/20" : "border-zinc-500/30 bg-white/[0.03]")
      : "border-white/[0.08] bg-black/20";

  return (
    <div title={tip} className={cn("rounded-lg border px-3 py-2 min-w-[168px] flex items-center justify-between gap-2 cursor-help transition-colors", border)}>
      <div className="flex flex-col">
        <div className={cn("flex items-center gap-1.5", accent ? "text-indigo-200" : "text-zinc-300")}>
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className="text-[10px] text-zinc-500 mt-0.5">{sub}</span>
      </div>
      <StateBadge state={state} count={count} unit={unit} />
    </div>
  );
}

function StateBadge({ state, count, unit }: { state: PathState; count: number; unit: string }) {
  if (state === "running")
    return <span className="h-3.5 w-3.5 rounded-full border-2 border-indigo-400/40 border-t-indigo-400 animate-spin" title="retrieving…" />;
  if (state === "used")
    return (
      <span className="flex items-center gap-1 text-indigo-300" title={`Used ${count} ${unit} to ground the answer`}>
        <Check className="w-4 h-4" />
        <span className="text-[10px] tabular-nums whitespace-nowrap">{count} {unit}</span>
      </span>
    );
  if (state === "error")
    return (
      <span className="flex items-center gap-1 text-red-400" title="This path errored (e.g. COA auth/namespace) — not used">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="text-[10px]">error</span>
      </span>
    );
  if (state === "unused")
    return (
      <span className="flex items-center gap-1 text-zinc-500" title={`Returned 0 ${unit} — not used for this answer`}>
        <X className="w-3.5 h-3.5" />
        <span className="text-[10px] whitespace-nowrap">0 {unit}</span>
      </span>
    );
  return <span className="h-3.5 w-3.5 rounded-full border border-white/15" />;
}
