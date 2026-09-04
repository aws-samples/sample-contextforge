"use client";
import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { verticals } from "@/data/verticals";
import { classifications } from "@/data/enterprise";
import { Badge } from "@/components/ui/badge";
import { Database, Globe, FileJson, Plus, X, CheckCircle2, Loader2, ArrowRight, Cloud, Server, FileText, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, typeof Database> = { S3: Database, Web: Globe, API: FileJson, CSV: FileText };
const typeColors: Record<string, string> = { S3: "text-amber-400", Web: "text-blue-400", API: "text-purple-400", CSV: "text-emerald-400" };

const sourceTypes = [
  { id: "s3", label: "Amazon S3", desc: "Documents, PDFs, JSON from S3 buckets", icon: Database, color: "amber" },
  { id: "web", label: "Web Crawler", desc: "Crawl and index web pages", icon: Globe, color: "blue" },
  { id: "api", label: "Custom API", desc: "Push content via REST endpoint", icon: Server, color: "purple" },
  { id: "csv", label: "CSV / Structured", desc: "Import structured data files", icon: FileText, color: "emerald" },
  { id: "confluence", label: "Confluence", desc: "Sync Confluence spaces", icon: Cloud, color: "cyan" },
];

export default function SourcesPage() {
  const { vertical } = useAppStore();
  const data = verticals[vertical];
  const [showAdd, setShowAdd] = useState(false);
  const [showSchema, setShowSchema] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Source Connector</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{data.name} — {data.sources.length} connected data sources</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-indigo-900/30 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Source
        </button>
      </div>

      {/* Source Cards */}
      <div className="grid gap-3">
        {data.sources.map((s) => {
          const Icon = typeIcons[s.type] || Database;
          const color = typeColors[s.type] || "text-zinc-400";
          return (
            <div key={s.id} className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] p-4 transition-all duration-200 hover:border-white/[0.1]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-lg bg-white/[0.05] border border-white/[0.06]", color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-zinc-100">{s.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{s.docs.toLocaleString()} documents • {s.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-600">{s.lastSync}</span>
                  {/* Data classification badge */}
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border flex items-center gap-1",
                    s.id === "s1" || s.id === "s3" ? classifications.Confidential.color : s.id === "s2" ? classifications.Internal.color : classifications.Public.color)}>
                    <Lock className="w-2.5 h-2.5" />
                    {s.id === "s1" || s.id === "s3" ? "Confidential" : s.id === "s2" ? "Internal" : "Public"}
                  </span>
                  {s.status === "synced" && <Badge className="bg-emerald-950/50 text-emerald-400 border border-emerald-800/30 text-xs">✓ Synced</Badge>}
                  {s.status === "syncing" && <Badge className="bg-amber-950/50 text-amber-400 border border-amber-800/30 text-xs animate-pulse">⟳ Syncing</Badge>}
                  {s.status === "error" && <Badge className="bg-red-950/50 text-red-400 border border-red-800/30 text-xs">× Error</Badge>}
                </div>
              </div>
              {/* Progress bar for syncing */}
              {s.status === "syncing" && (
                <div className="mt-3 h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full animate-[pulse_2s_ease-in-out_infinite] w-2/3" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button className="px-4 py-2 border border-white/[0.08] rounded-lg text-sm text-zinc-300 hover:bg-white/[0.04] transition-colors">Sync All</button>
        <button onClick={() => setShowSchema(true)} className="px-4 py-2 border border-white/[0.08] rounded-lg text-sm text-zinc-300 hover:bg-white/[0.04] transition-colors">View Schema</button>
      </div>

      {/* View Schema Modal */}
      {showSchema && <SchemaModal vertical={vertical} onClose={() => setShowSchema(false)} />}

      {/* Add Source Walkthrough */}
      {showAdd && <AddSourceWalkthrough vertical={vertical} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddSourceWalkthrough({ vertical, onClose }: { vertical: string; onClose: () => void }) {
  const [step, setStep] = useState(0); // 0=select type, 1=configure, 2=connecting, 3=done
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [config, setConfig] = useState({ name: "", path: "" });
  const [progress, setProgress] = useState(0);

  // Simulate connection progress
  useEffect(() => {
    if (step === 2) {
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) { clearInterval(interval); setTimeout(() => setStep(3), 400); return 100; }
          return p + Math.random() * 15;
        });
      }, 300);
      return () => clearInterval(interval);
    }
  }, [step]);

  const defaultConfigs: Record<string, { name: string; path: string }> = {
    s3: vertical === "cyber" ? { name: "Threat Intel Reports", path: "s3://<your-bucket>/threat-intel/" } : { name: "NERC CIP Standards", path: "s3://<your-bucket>/nerc-cip/" },
    web: vertical === "cyber" ? { name: "MITRE ATT&CK", path: "https://attack.mitre.org/techniques/" } : { name: "FERC Regulations", path: "https://www.ferc.gov/industries-data/" },
    api: vertical === "cyber" ? { name: "NVD CVE API", path: "https://services.nvd.nist.gov/rest/json/cves/2.0" } : { name: "Grid Telemetry API", path: "https://api.grid-ops.internal/v2/events" },
    csv: vertical === "cyber" ? { name: "SBOM Registry", path: "sbom-enterprise-2024.json (CycloneDX)" } : { name: "Asset Registry", path: "asset-registry-substations.csv (550 records)" },
    confluence: vertical === "cyber" ? { name: "Security Runbooks", path: "Confluence Space: SEC-OPS" } : { name: "Maintenance Procedures", path: "Confluence Space: GRID-OPS" },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-white/[0.08] bg-[#111118] shadow-2xl shadow-black/50" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-semibold text-white">Add Data Source</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Step {step + 1} of 4 — {["Select Type", "Configure", "Connecting", "Complete"][step]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400"><X className="w-4 h-4" /></button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn("h-1 flex-1 rounded-full transition-all duration-500", i <= step ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-zinc-800")} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[320px]">
          {step === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-zinc-400 mb-4">Choose the type of data source to connect:</p>
              {sourceTypes.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => { setSelectedType(t.id); setConfig(defaultConfigs[t.id]); }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                      selectedType === t.id
                        ? "border-indigo-500/50 bg-indigo-950/30"
                        : "border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02]"
                    )}>
                    <div className={cn("p-2 rounded-lg bg-white/[0.05]")}>
                      <Icon className={cn("w-4 h-4", `text-${t.color}-400`)} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-200">{t.label}</div>
                      <div className="text-xs text-zinc-500">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">Configure your <span className="text-white font-medium">{sourceTypes.find(t => t.id === selectedType)?.label}</span> connection:</p>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Display Name</label>
                <input value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/50" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">{selectedType === "s3" ? "S3 URI" : selectedType === "web" ? "Start URL" : selectedType === "api" ? "API Endpoint" : "File Path"}</label>
                <input value={config.path} onChange={(e) => setConfig({ ...config, path: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 font-mono text-xs focus:outline-none focus:border-indigo-500/50" />
              </div>
              <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-800/20">
                <p className="text-xs text-indigo-300/80">💡 Documents will be parsed, chunked, and embedded using your Pipeline configuration. Entities will be extracted for the Knowledge Graph.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center justify-center h-[280px] space-y-6">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-200">Connecting to {config.name}...</p>
                <p className="text-xs text-zinc-500 mt-1">Validating access • Scanning documents • Initializing sync</p>
              </div>
              <div className="w-full max-w-xs">
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-zinc-600">
                  <span>Discovering files...</span>
                  <span>{Math.round(Math.min(progress, 100))}%</span>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center justify-center h-[280px] space-y-4">
              <div className="relative">
                <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-[ping_2s_ease-in-out_1]" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">Source Connected!</p>
                <p className="text-sm text-zinc-400 mt-1">{config.name}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 w-full max-w-xs text-center">
                <div><div className="text-lg font-bold text-indigo-400">{vertical === "cyber" ? "247" : "143"}</div><div className="text-[10px] text-zinc-500">Files Found</div></div>
                <div><div className="text-lg font-bold text-purple-400">{vertical === "cyber" ? "1,482" : "891"}</div><div className="text-[10px] text-zinc-500">Chunks</div></div>
                <div><div className="text-lg font-bold text-emerald-400">{vertical === "cyber" ? "312" : "167"}</div><div className="text-[10px] text-zinc-500">Entities</div></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-between">
          {step > 0 && step < 3 && (
            <button onClick={() => setStep(step - 1)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Back</button>
          )}
          {step === 0 && <div />}
          {step === 3 && <div />}
          {step === 0 && (
            <button onClick={() => setStep(1)} disabled={!selectedType}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-30 text-white rounded-lg text-sm font-medium transition-all">
              Next <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {step === 1 && (
            <button onClick={() => { setStep(2); setProgress(0); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-sm font-medium transition-all">
              Connect <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {step === 3 && (
            <button onClick={onClose}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-sm font-medium transition-all">
              Done — View Sources
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SchemaModal({ vertical, onClose }: { vertical: string; onClose: () => void }) {
  const schema = vertical === "cyber" ? {
    title: "ThreatGraph Ingestion Schema",
    entities: [
      { type: "CVE", fields: "cve_id, cvss_score, cvss_vector, affected_products, patch_status" },
      { type: "ThreatActor", fields: "name, aliases, origin, motivation, sophistication" },
      { type: "Technique", fields: "technique_id, tactic, description, detection_method" },
      { type: "Malware", fields: "name, family, capabilities, c2_protocol" },
      { type: "Campaign", fields: "name, start_date, targets_sector, attribution" },
      { type: "Asset", fields: "asset_id, product_name, version, owner_team" },
      { type: "Indicator", fields: "ioc_type, value, confidence, first_seen" },
    ],
    relations: ["EXPLOITS", "USES_TECHNIQUE", "DEPLOYS_MALWARE", "CHAINS_TO", "AFFECTS_ASSET", "ATTRIBUTED_TO", "MITIGATED_BY"],
  } : {
    title: "GridKnowledge Ingestion Schema",
    entities: [
      { type: "Asset", fields: "asset_id, name, type, voltage_kv, bes_designation, location" },
      { type: "Standard", fields: "standard_id, title, issuing_body, version, effective_date" },
      { type: "Requirement", fields: "req_id, description, control_type, compliance_deadline" },
      { type: "OutageEvent", fields: "event_id, date, duration_min, customers_affected, root_cause" },
      { type: "WorkOrder", fields: "wo_id, asset_id, type, status, triggered_by_reg" },
      { type: "GridZone", fields: "zone_id, region, control_area, peak_load_mw" },
      { type: "Violation", fields: "violation_id, standard_ref, asset_id, severity, remediation_due" },
    ],
    relations: ["GOVERNED_BY", "REQUIRES", "APPLIES_TO", "CAUSED_BY", "CASCADED_TO", "CONNECTED_TO", "TRIGGERS_WORKORDER", "VIOLATES", "OVERLAPS_WITH"],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-xl mx-4 rounded-2xl border border-white/[0.08] bg-[#111118] shadow-2xl max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.06] sticky top-0 bg-[#111118] z-10">
          <div>
            <h2 className="text-lg font-semibold text-white">{schema.title}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Entity types and relationships extracted during ingestion</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Entity Types ({schema.entities.length})</h3>
            <div className="space-y-2">
              {schema.entities.map((e) => (
                <div key={e.type} className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="text-sm font-medium text-indigo-300">{e.type}</div>
                  <div className="text-xs text-zinc-500 mt-1 font-mono">{e.fields}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Relationships ({schema.relations.length})</h3>
            <div className="flex flex-wrap gap-2">
              {schema.relations.map((r) => (
                <span key={r} className="px-2.5 py-1 rounded-md bg-purple-950/30 border border-purple-800/20 text-xs text-purple-300 font-mono">{r}</span>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-800/20">
            <p className="text-xs text-indigo-300/80">💡 Schema is used by Amazon Bedrock (Claude) during graph construction to extract entities and relationships from your ingested documents.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
