"use client";
import { useAppStore } from "@/lib/store";
import { verticals, type Vertical } from "@/data/verticals";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, RotateCcw } from "lucide-react";
import { AwsLogo } from "@/components/aws-logo";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const cyberColors: Record<string, string> = {
  ThreatActor: "#ef4444", CVE: "#f59e0b", Technique: "#8b5cf6", Malware: "#ec4899", Campaign: "#06b6d4", Asset: "#10b981", Indicator: "#6366f1",
};
const energyColors: Record<string, string> = {
  Outage: "#ef4444", Asset: "#10b981", Crew: "#3b82f6", Obstacle: "#f59e0b", Feeder: "#06b6d4", Customer: "#a855f7", RootCause: "#ec4899",
};
const otsecColors: Record<string, string> = {
  ThreatGroup: "#ef4444", Vulnerability: "#f59e0b", ICSTechnique: "#8b5cf6", Malware: "#ec4899", OTAsset: "#10b981", PurdueZone: "#06b6d4", Compliance: "#3b82f6",
};
const prodqualityColors: Record<string, string> = {
  Product: "#f59e0b", ReviewCluster: "#ef4444", Region: "#06b6d4", Store: "#3b82f6", Return: "#ec4899", Component: "#10b981", ComponentLot: "#a855f7", Supplier: "#8b5cf6", PurchaseOrder: "#eab308", SupplierScorecard: "#14b8a6", RootCause: "#f43f5e", CorrectiveAction: "#22c55e",
};

function colorsFor(vertical: Vertical): Record<string, string> {
  return vertical === "cyber" ? cyberColors : vertical === "energy" ? energyColors : vertical === "otsec" ? otsecColors : prodqualityColors;
}

// Generate a denser graph with more nodes for a richer visualization
function generateDenseGraph(vertical: Vertical) {
  const types = vertical === "cyber"
    ? [{ type: "ThreatActor", count: 18 }, { type: "CVE", count: 45 }, { type: "Technique", count: 38 }, { type: "Malware", count: 14 }, { type: "Campaign", count: 12 }, { type: "Asset", count: 35 }, { type: "Indicator", count: 22 }]
    : vertical === "energy"
    ? [{ type: "Outage", count: 24 }, { type: "Asset", count: 52 }, { type: "Crew", count: 16 }, { type: "Obstacle", count: 20 }, { type: "Feeder", count: 32 }, { type: "Customer", count: 28 }, { type: "RootCause", count: 18 }]
    : vertical === "prodquality"
    ? [{ type: "Product", count: 8 }, { type: "ReviewCluster", count: 16 }, { type: "Region", count: 6 }, { type: "Store", count: 30 }, { type: "Return", count: 22 }, { type: "Component", count: 24 }, { type: "ComponentLot", count: 18 }, { type: "Supplier", count: 12 }, { type: "PurchaseOrder", count: 26 }]
    : [{ type: "ThreatGroup", count: 12 }, { type: "Vulnerability", count: 38 }, { type: "ICSTechnique", count: 28 }, { type: "Malware", count: 10 }, { type: "OTAsset", count: 48 }, { type: "PurdueZone", count: 6 }, { type: "Compliance", count: 14 }];

  const colors = colorsFor(vertical);
  const nodes: { id: string; label: string; type: string; color: string; connections: number }[] = [];
  const links: { source: string; target: string }[] = [];

  // Key named nodes (high connectivity)
  const namedNodes = vertical === "cyber"
    ? [{ id: "apt29", label: "Midnight Blizzard", type: "ThreatActor" }, { id: "vt", label: "Volt Typhoon", type: "ThreatActor" }, { id: "sc", label: "Scattered Spider", type: "ThreatActor" }, { id: "cve-log4j", label: "CVE-2021-44228", type: "CVE" }, { id: "cve-solar", label: "CVE-2020-10148", type: "CVE" }, { id: "sunburst", label: "SUNBURST", type: "Malware" }, { id: "cobalt", label: "CobaltStrike", type: "Malware" }, { id: "solar-camp", label: "SolarWinds Campaign", type: "Campaign" }, { id: "log4j-camp", label: "Log4Shell Campaign", type: "Campaign" }]
    : vertical === "energy"
    ? [{ id: "outage-4471", label: "Outage OE-4471", type: "Outage" }, { id: "tx447", label: "TX-447 Transformer", type: "Asset" }, { id: "crew-alpha", label: "Crew Alpha-7", type: "Crew" }, { id: "veg-rd12", label: "Vegetation Rd-12", type: "Obstacle" }, { id: "feeder-2201", label: "Feeder F-2201", type: "Feeder" }, { id: "cust-zone-a", label: "Zone A (2,400 homes)", type: "Customer" }, { id: "overload", label: "Thermal Overload", type: "RootCause" }, { id: "sub-east", label: "Eastview Substation", type: "Asset" }, { id: "storm-july", label: "Storm Jul-28", type: "RootCause" }]
    : vertical === "prodquality"
    ? [{ id: "drill-vc20", label: "VoltCore 20V Drill", type: "Product" }, { id: "rev-cluster-cold", label: "Reviews: dies in cold", type: "ReviewCluster" }, { id: "region-north", label: "Cold-Climate Region", type: "Region" }, { id: "store-lowes-mn", label: "Lowe's MN", type: "Store" }, { id: "return-batch-winter", label: "Winter Return Batch", type: "Return" }, { id: "battery-pack", label: "20V Battery Pack", type: "Component" }, { id: "cell-lot-ns", label: "Cell Lot NS-2411", type: "ComponentLot" }, { id: "supplier-northstar", label: "NorthStar Cells", type: "Supplier" }, { id: "po-ns-4411", label: "PO #NS-4411", type: "PurchaseOrder" }]
    : [{ id: "voltzite", label: "VOLTZITE", type: "ThreatGroup" }, { id: "electrum", label: "ELECTRUM", type: "ThreatGroup" }, { id: "chernovite", label: "CHERNOVITE", type: "ThreatGroup" }, { id: "vpn-gw", label: "VPN Gateway", type: "OTAsset" }, { id: "scada-srv", label: "SCADA Server", type: "OTAsset" }, { id: "plc-sub1", label: "PLC-SUB1", type: "OTAsset" }, { id: "pipedream", label: "PIPEDREAM", type: "Malware" }, { id: "cve-3400", label: "CVE-2024-3400", type: "Vulnerability" }, { id: "zone-dmz", label: "IT/OT DMZ", type: "PurdueZone" }];

  namedNodes.forEach((n) => nodes.push({ ...n, color: colors[n.type], connections: 0 }));

  // Generate anonymous nodes
  let nodeId = 0;
  types.forEach(({ type, count }) => {
    const existing = nodes.filter((n) => n.type === type).length;
    for (let i = 0; i < count - existing; i++) {
      nodes.push({ id: `${type}-${nodeId++}`, label: "", type, color: colors[type], connections: 0 });
    }
  });

  // Generate links - connect named nodes heavily, others sparsely
  const namedIds = namedNodes.map((n) => n.id);
  nodes.forEach((node) => {
    if (namedIds.includes(node.id)) return;
    // Connect each node to 1-3 random nodes, preferring named nodes
    const numLinks = 1 + Math.floor(Math.random() * 2.5);
    for (let i = 0; i < numLinks; i++) {
      const target = Math.random() < 0.4
        ? namedIds[Math.floor(Math.random() * namedIds.length)]
        : nodes[Math.floor(Math.random() * nodes.length)].id;
      if (target !== node.id) links.push({ source: node.id, target });
    }
  });

  // Connect named nodes to each other
  for (let i = 0; i < namedIds.length; i++) {
    for (let j = i + 1; j < namedIds.length; j++) {
      if (Math.random() < 0.35) links.push({ source: namedIds[i], target: namedIds[j] });
    }
  }

  // Count connections
  links.forEach((l) => {
    const s = nodes.find((n) => n.id === l.source);
    const t = nodes.find((n) => n.id === l.target);
    if (s) s.connections++;
    if (t) t.connections++;
  });

  return { nodes, links };
}

export default function GraphPage() {
  const { vertical } = useAppStore();
  const data = verticals[vertical];
  const fgRef = useRef<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const colors = colorsFor(vertical);

  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });

  useEffect(() => {
    setGraphData(generateDenseGraph(vertical));
  }, [vertical]);

  // Entity type counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    graphData.nodes.forEach((n) => { counts[n.type] = (counts[n.type] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [graphData]);

  const highlightNodes = useMemo(() => {
    if (!searchTerm.trim()) return new Set<string>();
    const term = searchTerm.toLowerCase();
    return new Set(graphData.nodes.filter((n) => n.label.toLowerCase().includes(term) || n.type.toLowerCase().includes(term)).map((n) => n.id));
  }, [searchTerm, graphData]);

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
    const size = Math.max(3, Math.min(12, 3 + node.connections * 0.8));
    const highlighted = highlightNodes.size > 0 && highlightNodes.has(node.id);
    const dimmed = highlightNodes.size > 0 && !highlightNodes.has(node.id);

    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = dimmed ? "rgba(63,63,70,0.3)" : node.color;
    ctx.fill();

    if (highlighted) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Only show labels for high-connectivity nodes or highlighted
    if (node.label && (node.connections > 3 || highlighted)) {
      ctx.font = `${Math.max(3.5, Math.min(5, 3 + node.connections * 0.2))}px Inter, sans-serif`;
      ctx.fillStyle = dimmed ? "rgba(161,161,170,0.2)" : "#e4e4e7";
      ctx.textAlign = "center";
      ctx.fillText(node.label, node.x, node.y + size + 5);
    }
  }, [highlightNodes]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Knowledge Graph</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{data.name} — {graphData.nodes.length} entities, {graphData.links.length} relationships</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fgRef.current?.zoomToFit(400)} className="p-2 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-zinc-400 transition-colors">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search entities..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50" />
      </div>

      {/* Graph container */}
      <div className="relative rounded-xl border border-white/[0.06] bg-[#0c0c12] overflow-hidden">
        {/* Legend overlay */}
        <div className="absolute bottom-4 left-4 z-10 bg-[#0c0c12]/90 backdrop-blur-sm rounded-lg border border-white/[0.08] p-3 space-y-1.5">
          {typeCounts.map(([type, count]) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[type] }} />
              <span className="text-zinc-300 w-24">{type}</span>
              <span className="text-zinc-500">{count}</span>
            </div>
          ))}
        </div>

        {/* AWS Neptune badge */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#232f3e] border border-white/[0.1]">
          <AwsLogo className="h-3.5" />
          <span className="text-[10px] text-zinc-300">Neptune Analytics</span>
        </div>

        <div className="h-[550px] md:h-[620px]">
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node: any, color, ctx) => { ctx.beginPath(); ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill(); }}
            linkColor={() => "rgba(161,161,170,0.35)"}
            linkWidth={1}
            linkDirectionalParticles={0}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            warmupTicks={50}
            cooldownTime={3000}
            backgroundColor="#0c0c12"
          />
        </div>
      </div>
    </div>
  );
}
