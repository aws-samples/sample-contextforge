export const enterprise = {
  workspaces: [
    { id: "ws-1", name: "Security Operations", plan: "Enterprise", members: 12 },
    { id: "ws-2", name: "Grid Operations", plan: "Enterprise", members: 8 },
    { id: "ws-3", name: "Research Lab", plan: "Pro", members: 4 },
  ],
  currentUser: { name: "Sarah Chen", email: "s.chen@example.com", role: "Admin", avatar: "SC" },
  teamMembers: [
    { id: "u1", name: "Sarah Chen", email: "s.chen@example.com", role: "Admin", status: "Active", lastActive: "2 min ago" },
    { id: "u2", name: "James Rodriguez", email: "j.rodriguez@example.com", role: "Editor", status: "Active", lastActive: "15 min ago" },
    { id: "u3", name: "Priya Patel", email: "p.patel@example.com", role: "Editor", status: "Active", lastActive: "1 hr ago" },
    { id: "u4", name: "Marcus Johnson", email: "m.johnson@example.com", role: "Viewer", status: "Active", lastActive: "3 hr ago" },
    { id: "u5", name: "Emily Watson", email: "e.watson@example.com", role: "Viewer", status: "Invited", lastActive: "—" },
    { id: "u6", name: "David Kim", email: "d.kim@example.com", role: "Editor", status: "Active", lastActive: "1 day ago" },
  ],
  apiKeys: [
    { id: "k1", name: "Production API", key: "cf_live_••••••••k7Qm", created: "2026-05-12", lastUsed: "2 min ago", status: "Active", calls: 14832 },
    { id: "k2", name: "Staging API", key: "cf_test_••••••••xR4n", created: "2026-06-01", lastUsed: "1 hr ago", status: "Active", calls: 3201 },
    { id: "k3", name: "CI/CD Pipeline", key: "cf_ci_••••••••mP8j", created: "2026-06-10", lastUsed: "6 hr ago", status: "Active", calls: 891 },
    { id: "k4", name: "Legacy Integration", key: "cf_live_••••••••aB2w", created: "2026-03-01", lastUsed: "45 days ago", status: "Expired", calls: 0 },
  ],
  auditLog: [
    { id: "a1", action: "Source connected", user: "Sarah Chen", target: "NVD CVE Feed", time: "2 min ago", ip: "10.0.1.42" },
    { id: "a2", action: "Query executed", user: "James Rodriguez", target: "Attack chain analysis", time: "8 min ago", ip: "10.0.1.55" },
    { id: "a3", action: "Pipeline config updated", user: "Sarah Chen", target: "Chunking → Semantic", time: "22 min ago", ip: "10.0.1.42" },
    { id: "a4", action: "API key created", user: "Sarah Chen", target: "CI/CD Pipeline", time: "1 hr ago", ip: "10.0.1.42" },
    { id: "a5", action: "Team member invited", user: "Sarah Chen", target: "Emily Watson (Viewer)", time: "2 hr ago", ip: "10.0.1.42" },
    { id: "a6", action: "Source synced", user: "System", target: "MITRE ATT&CK", time: "3 hr ago", ip: "—" },
    { id: "a7", action: "Data classification updated", user: "Priya Patel", target: "Incident Reports → Confidential", time: "5 hr ago", ip: "10.0.2.18" },
    { id: "a8", action: "Model changed", user: "James Rodriguez", target: "Claude 4 Sonnet → Nova Premier", time: "1 day ago", ip: "10.0.1.55" },
    { id: "a9", action: "Workspace settings updated", user: "Sarah Chen", target: "Data retention → 90 days", time: "1 day ago", ip: "10.0.1.42" },
    { id: "a10", action: "Source deleted", user: "Sarah Chen", target: "Old SBOM v1", time: "2 days ago", ip: "10.0.1.42" },
  ],
  dataGovernance: {
    retention: "90 days",
    encryption: "AES-256 (AWS KMS)",
    region: "us-west-2",
    compliance: ["SOC 2 Type II", "ISO 27001", "FedRAMP Moderate"],
    classifications: ["Public", "Internal", "Confidential", "Restricted"],
    dlpEnabled: true,
    auditRetention: "365 days",
  },
  usage: {
    period: "June 2026",
    tokenConsumption: { embedding: 14_200_000, generation: 3_800_000, extraction: 6_100_000 },
    apiCalls: { queries: 4_821, ingestion: 312, graphOps: 1_044 },
    costs: { bedrock: 142.30, neptune: 149.76, opensearch: 345.60, s3: 4.20, lambda: 8.90, total: 650.76 },
    quotas: { queriesPerMin: { used: 42, limit: 100 }, storageTB: { used: 0.8, limit: 2 }, teamMembers: { used: 6, limit: 25 } },
  },
  notifications: [
    { id: "n1", title: "Sync complete", desc: "NVD CVE Feed — 247 new documents", time: "2 min ago", read: false },
    { id: "n2", title: "API key expiring", desc: "Legacy Integration expires in 7 days", time: "1 hr ago", read: false },
    { id: "n3", title: "New team member", desc: "Emily Watson accepted invite", time: "2 hr ago", read: true },
  ],
};

export const roles = {
  Admin: { color: "text-amber-400 bg-amber-950/30 border-amber-800/30", permissions: "Full access — manage workspace, team, billing, sources, queries" },
  Editor: { color: "text-blue-400 bg-blue-950/30 border-blue-800/30", permissions: "Create/edit sources, run queries, view graph. Cannot manage team or billing." },
  Viewer: { color: "text-zinc-400 bg-zinc-800/30 border-zinc-700/30", permissions: "Read-only access to sources, graph, and query results. Cannot modify." },
};

export const classifications = {
  Public: { color: "text-emerald-400 bg-emerald-950/30 border-emerald-800/30" },
  Internal: { color: "text-blue-400 bg-blue-950/30 border-blue-800/30" },
  Confidential: { color: "text-amber-400 bg-amber-950/30 border-amber-800/30" },
  Restricted: { color: "text-red-400 bg-red-950/30 border-red-800/30" },
};
