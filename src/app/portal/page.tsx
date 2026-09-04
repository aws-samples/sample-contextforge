"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock, Truck, TreePine, Camera, MessageCircle, Send, Zap, ChevronDown } from "lucide-react";

const outageData = {
  id: "OE-4471",
  status: "active" as const,
  address: "123 Maple Drive, Eastview",
  feeder: "F-2201",
  substation: "Eastview Substation",
  startTime: "2:14 PM",
  customersAffected: 2400,
  zone: "Zone A",
  rootCause: {
    type: "Transformer Thermal Overload",
    detail: "TX-447 experienced thermal overload due to sustained 108°F heat combined with peak afternoon demand. Insulation damage confirmed on phase-B bushing.",
    confidence: 94,
  },
  crew: {
    name: "Alpha-7",
    status: "En Route (Rerouting)",
    dispatchTime: "2:22 PM",
    members: 4,
    equipment: "45-ft bucket truck, portable transformer",
  },
  obstacles: [
    { type: "Vegetation", location: "Road 12 (primary access route)", impact: "Crew cannot use direct route — rerouting via Highway 9", delayMin: 45 },
  ],
  eta: {
    original: "4:30 PM",
    revised: "5:15 PM",
    reason: "Vegetation blocking primary access road (+45 min reroute)",
  },
  evidence: [
    { id: "DI-0091", type: "Drone Photo", desc: "Thermal damage on TX-447 phase-B bushing", time: "2:31 PM" },
    { id: "GIS-4471", type: "GIS Imagery", desc: "Vegetation overgrowth on Road 12 access path", time: "2:28 PM" },
    { id: "SCADA-T447", type: "Sensor Data", desc: "Temperature spike: 142°C (threshold: 105°C)", time: "2:12 PM" },
  ],
  timeline: [
    { time: "2:12 PM", event: "SCADA alert: TX-447 temperature exceeding threshold", icon: "alert" },
    { time: "2:14 PM", event: "Transformer protection relay tripped — feeder de-energized", icon: "outage" },
    { time: "2:16 PM", event: "Outage confirmed: 2,400 customers affected (Zone A)", icon: "customers" },
    { time: "2:22 PM", event: "Crew Alpha-7 dispatched from maintenance yard", icon: "crew" },
    { time: "2:28 PM", event: "GIS imagery flagged vegetation on Road 12", icon: "obstacle" },
    { time: "2:31 PM", event: "Drone deployed — confirmed thermal damage on TX-447", icon: "evidence" },
    { time: "2:38 PM", event: "Crew rerouting via Highway 9 (ETA revised +45 min)", icon: "delay" },
    { time: "2:45 PM", event: "Portable generators deployed to Eastview Hospital", icon: "action" },
  ],
  graphExplanation: `Your address (123 Maple Drive) is served by Feeder F-2201 from Eastview Substation.

🔴 Root Cause: Transformer TX-447 experienced thermal overload at 2:14 PM due to sustained 108°F heat + peak demand.

📷 Drone imagery (DI-0091) confirms insulation damage on phase-B bushing.

👷 Crew Alpha-7 dispatched at 2:22 PM, currently rerouting.
⚠️ Delay: Vegetation overgrowth on Road 12 blocking direct access — crew rerouting via Highway 9 (adds ~45 min).

⏱️ Revised ETA: 5:15 PM (was 4:30 PM before reroute)

💡 2,400 homes affected in Zone A. Portable generators deployed to critical facilities (hospital, water pump).`,
};

export default function PortalPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showTimeline, setShowTimeline] = useState(false);

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatInput("");
    // Simulate AI response
    setTimeout(() => {
      const responses: Record<string, string> = {
        default: outageData.graphExplanation,
      };
      const lower = userMsg.toLowerCase();
      let response = responses.default;
      if (lower.includes("when") || lower.includes("eta") || lower.includes("how long")) {
        response = `⏱️ Current ETA: ${outageData.eta.revised}\n\nThe original estimate was ${outageData.eta.original}, but it was revised because: ${outageData.eta.reason}.\n\nOnce Crew Alpha-7 arrives (est. 15 min), the transformer replacement itself takes approximately 90 minutes.`;
      } else if (lower.includes("why") || lower.includes("cause") || lower.includes("what happened")) {
        response = `🔴 Root Cause: ${outageData.rootCause.type}\n\n${outageData.rootCause.detail}\n\nConfidence: ${outageData.rootCause.confidence}% (based on SCADA sensor data + drone imagery confirmation)`;
      } else if (lower.includes("crew") || lower.includes("who")) {
        response = `👷 Crew ${outageData.crew.name} (${outageData.crew.members} members)\nStatus: ${outageData.crew.status}\nDispatched: ${outageData.crew.dispatchTime}\nEquipment: ${outageData.crew.equipment}\n\n⚠️ Currently rerouting due to vegetation on Road 12. Expected on-site within 35 minutes.`;
      } else if (lower.includes("safe") || lower.includes("danger")) {
        response = `⚡ Safety Information:\n\n• Stay away from any downed power lines (min 35 feet)\n• Do not use generators indoors\n• Keep refrigerator/freezer doors closed\n• Unplug sensitive electronics to prevent surge damage on restoration\n• If you see sparking or smell burning, call 911 immediately\n\nYour area is safe — no downed lines reported in Zone A.`;
      }
      setChatMessages((prev) => [...prev, { role: "ai", text: response }]);
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-950/30 to-orange-950/20 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Power Outage in Your Area</h1>
              <p className="text-sm text-zinc-400 mt-1">{outageData.address} • {outageData.customersAffected.toLocaleString()} customers affected</p>
              <p className="text-xs text-zinc-500 mt-0.5">Outage ID: {outageData.id} • Started: {outageData.startTime}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-2xl font-bold text-amber-400">{outageData.eta.revised}</div>
            <div className="text-xs text-zinc-500">Estimated Restoration</div>
          </div>
        </div>
      </div>

      {/* Key Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Root Cause */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-red-400" />
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Root Cause</span>
          </div>
          <p className="text-sm font-medium text-white">{outageData.rootCause.type}</p>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{outageData.rootCause.detail}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${outageData.rootCause.confidence}%` }} />
            </div>
            <span className="text-[10px] text-emerald-400">{outageData.rootCause.confidence}% confidence</span>
          </div>
        </div>

        {/* Crew Status */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-blue-400" />
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Crew Status</span>
          </div>
          <p className="text-sm font-medium text-white">Crew {outageData.crew.name}</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Status</span><span className="text-amber-400">{outageData.crew.status}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Dispatched</span><span className="text-zinc-300">{outageData.crew.dispatchTime}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Team Size</span><span className="text-zinc-300">{outageData.crew.members} technicians</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Equipment</span><span className="text-zinc-300 text-right max-w-[180px]">{outageData.crew.equipment}</span></div>
          </div>
        </div>

        {/* Obstacles */}
        <div className="rounded-xl border border-amber-500/10 bg-amber-950/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TreePine className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Access Issues</span>
          </div>
          {outageData.obstacles.map((obs, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-amber-300">{obs.type}</p>
              <p className="text-xs text-zinc-400 mt-1">{obs.location}</p>
              <p className="text-xs text-zinc-500 mt-1">{obs.impact}</p>
              <div className="mt-2 px-2 py-1 rounded bg-amber-950/30 border border-amber-800/20 inline-block">
                <span className="text-[11px] text-amber-400">+{obs.delayMin} min delay</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence Section */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-zinc-200">Field Evidence</span>
          <span className="text-[10px] text-zinc-600 ml-auto">Powered by AI image analysis (Amazon Bedrock)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {outageData.evidence.map((ev) => (
            <div key={ev.id} className="rounded-lg border border-white/[0.06] bg-black/20 overflow-hidden">
              {/* Mock image placeholder */}
              <div className="h-32 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center relative">
                <div className="text-center">
                  <Camera className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-[10px] text-zinc-600 mt-1">{ev.type}</p>
                </div>
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-zinc-400">{ev.id}</div>
              </div>
              <div className="p-3">
                <p className="text-xs text-zinc-300">{ev.desc}</p>
                <p className="text-[10px] text-zinc-600 mt-1">{ev.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <button onClick={() => setShowTimeline(!showTimeline)}
          className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-200">Event Timeline</span>
            <span className="text-[10px] text-zinc-600">{outageData.timeline.length} events</span>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", showTimeline && "rotate-180")} />
        </button>
        {showTimeline && (
          <div className="px-4 md:px-5 pb-5 border-t border-white/[0.06]">
            <div className="relative mt-4 space-y-0">
              {outageData.timeline.map((item, i) => (
                <div key={i} className="flex gap-4 relative">
                  {/* Vertical line */}
                  {i < outageData.timeline.length - 1 && (
                    <div className="absolute left-[15px] top-[28px] w-px h-[calc(100%-4px)] bg-zinc-800" />
                  )}
                  {/* Dot */}
                  <div className={cn("w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 border",
                    item.icon === "alert" ? "bg-red-950/50 border-red-800/30" :
                    item.icon === "outage" ? "bg-red-950/50 border-red-800/30" :
                    item.icon === "obstacle" || item.icon === "delay" ? "bg-amber-950/50 border-amber-800/30" :
                    item.icon === "crew" || item.icon === "action" ? "bg-blue-950/50 border-blue-800/30" :
                    "bg-zinc-800/50 border-zinc-700/30"
                  )}>
                    <div className={cn("w-2 h-2 rounded-full",
                      item.icon === "alert" || item.icon === "outage" ? "bg-red-400" :
                      item.icon === "obstacle" || item.icon === "delay" ? "bg-amber-400" :
                      item.icon === "crew" || item.icon === "action" ? "bg-blue-400" :
                      "bg-zinc-400"
                    )} />
                  </div>
                  {/* Content */}
                  <div className="pb-5 pt-1">
                    <p className="text-xs text-zinc-300">{item.event}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Chat - Ask About Your Outage */}
      <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 to-purple-950/10 overflow-hidden">
        <button onClick={() => setChatOpen(!chatOpen)}
          className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-indigo-200">Ask About Your Outage</span>
            <span className="text-[10px] text-indigo-400/60 bg-indigo-950/50 px-2 py-0.5 rounded">GraphRAG powered</span>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-indigo-400 transition-transform", chatOpen && "rotate-180")} />
        </button>
        {chatOpen && (
          <div className="border-t border-indigo-500/10">
            {/* Messages */}
            <div className="max-h-80 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-xs text-zinc-500">Ask anything about your outage. Examples:</p>
                  <div className="mt-3 flex flex-wrap gap-2 justify-center">
                    {["Why is my power out?", "When will it be fixed?", "Is it safe?", "Who is working on it?"].map((q) => (
                      <button key={q} onClick={() => { setChatInput(q); }}
                        className="px-3 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-950/20 text-[11px] text-indigo-300 hover:bg-indigo-950/40 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] rounded-xl px-4 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-white/[0.05] border border-white/[0.08] text-zinc-200"
                  )}>
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{msg.text}</pre>
                  </div>
                </div>
              ))}
            </div>
            {/* Input */}
            <div className="p-3 border-t border-indigo-500/10 flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask about your outage..."
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50" />
              <button onClick={sendMessage}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg transition-all">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-4 space-y-2">
        <p className="text-[11px] text-zinc-600">Outage intelligence powered by Amazon Bedrock + Neptune GraphRAG</p>
        <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-600">
          <span>Report downed line: <span className="text-zinc-400">1-800-555-0199</span></span>
          <span>•</span>
          <span>Emergency: <span className="text-zinc-400">911</span></span>
        </div>
      </div>
    </div>
  );
}
