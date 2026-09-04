"use client";
import { useAppStore } from "@/lib/store";
import { verticals } from "@/data/verticals";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

export default function MonitorPage() {
  const { vertical } = useAppStore();
  const data = verticals[vertical];
  const m = data.monitor;

  const accuracyData = [
    { name: "GraphRAG", accuracy: m.graphAccuracy, fill: "#6366f1" },
    { name: "Vector-Only", accuracy: m.vectorAccuracy, fill: "#27272a" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Observability Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-0.5">{data.name} — semantic layer health & metrics</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Ingestion" badge="Amazon Bedrock" items={[
          { label: "Docs processed", value: m.docsProcessed.toLocaleString() },
          { label: "Chunks created", value: m.chunksCreated.toLocaleString() },
          { label: "Sync jobs", value: `${m.syncJobs.ok} OK`, extra: m.syncJobs.fail > 0 ? `${m.syncJobs.fail} FAIL` : undefined },
        ]} />
        <StatCard title="Graph" badge="Neptune Analytics" items={[
          { label: "Nodes", value: data.graphStats.nodes.toLocaleString() },
          { label: "Edges", value: data.graphStats.edges.toLocaleString() },
          { label: "Connected", value: `${data.graphStats.connected}%`, highlight: true },
          { label: "Orphan nodes", value: `${data.graphStats.orphan}%` },
        ]} />
        <StatCard title="Retrieval" badge="OpenSearch Serverless" items={[
          { label: "p50 latency", value: `${m.p50}ms` },
          { label: "p99 latency", value: `${m.p99}ms` },
          { label: "Cache hit rate", value: `${m.cacheHit}%` },
          { label: "Reranking", value: "ON", highlight: true },
        ]} />
      </div>

      {/* Accuracy chart */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-300">GraphRAG vs Vector Accuracy</h3>
          <span className="text-xs text-zinc-600">Last 50 queries</span>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={accuracyData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} width={85} />
              <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }} />
              <Bar dataKey="accuracy" radius={[0, 6, 6, 0]} barSize={24}>
                {accuracyData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-6 mt-3 pt-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-indigo-500" /><span className="text-xs text-zinc-400">GraphRAG: <span className="text-white font-medium">{m.graphAccuracy}%</span></span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-zinc-700" /><span className="text-xs text-zinc-400">Vector-Only: <span className="text-white font-medium">{m.vectorAccuracy}%</span></span></div>
          <div className="text-xs text-emerald-400 ml-auto">+{m.graphAccuracy - m.vectorAccuracy}% improvement</div>
        </div>
      </div>

      {/* Cost */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Estimated Monthly Cost</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CostItem label="Neptune Analytics" cost="$149.76" detail="$0.48/hr × 312hr" />
          <CostItem label="Bedrock (embed)" cost="$28.40" detail="$0.002/1K tokens" />
          <CostItem label="OpenSearch Serverless" cost="$345.60" detail="2 OCU × $0.24/hr" />
          <CostItem label="Bedrock (inference)" cost="~$52.00" detail="Varies by usage" />
        </div>
        <div className="mt-4 pt-3 border-t border-white/[0.04] flex justify-between items-center">
          <span className="text-xs text-zinc-500">Total estimated</span>
          <span className="text-lg font-bold text-white">$575.76<span className="text-xs text-zinc-500 font-normal">/month</span></span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, badge, items }: { title: string; badge?: string; items: { label: string; value: string; extra?: string; highlight?: boolean }[] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium">{title}</h3>
        {badge && <span className="text-[9px] text-indigo-400/70 bg-indigo-950/30 border border-indigo-800/20 rounded px-1.5 py-0.5">{badge}</span>}
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">{item.label}</span>
            <div className="flex items-center gap-1.5">
              <span className={cn("font-medium", item.highlight ? "text-emerald-400" : "text-zinc-200")}>{item.value}</span>
              {item.extra && <span className="text-red-400 text-xs">{item.extra}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CostItem({ label, cost, detail }: { label: string; cost: string; detail: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-base font-semibold text-zinc-100 mt-1">{cost}</div>
      <div className="text-[10px] text-zinc-600 mt-0.5">{detail}</div>
    </div>
  );
}
