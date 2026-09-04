/**
 * Shared root-cause naming for supply-chain / quality graphs.
 *
 * A traversed subgraph often contains both the culprit and good-path decoys —
 * a failing component lot alongside a prior good lot from the *same* supplier,
 * and multiple purchase orders to that supplier. Naming every Supplier/lot/PO
 * would muddy the finding, so selection is deterministic:
 *   1. score each candidate on how strongly its properties signal a failure,
 *   2. once the culprit lot is chosen, resolve its supplier and PO by walking
 *      the actual graph edges (SUPPLIED_BY / SOURCED_VIA / ROOT_CAUSED_BY),
 *      not by string-matching labels.
 *
 * Used by both Mode 1 (local-mock-provider's deterministic summary) and Mode 2
 * (synthesize's simulated answer) so the two modes name the same root cause.
 * Returns undefined for graphs with no supply-chain culprit (e.g. OT security),
 * in which case callers simply omit the line.
 */

/** Minimal node/edge shapes both providers satisfy. */
export interface RcNode {
  id: string;
  label: string;
  type: string;
  properties?: Record<string, unknown>;
}
export interface RcEdge {
  source_id: string;
  target_id: string;
  relation: string;
}

/** Hard failure signals outweigh soft ones; a benign `note` alone never qualifies. */
function failureScore(n: RcNode): number {
  const p = n.properties ?? {};
  const blob = JSON.stringify(p).toLowerCase();
  let score = 0;
  if (/\bfail\b|fail @|@\s*\d+f/.test(blob)) score += 5;
  if (blob.includes("conditional")) score += 4;
  if (blob.includes("without re-qualification") || /requalified"?:\s*"?no/.test(blob)) score += 4;
  if (blob.includes("quarantine")) score += 2;
  const cap = Number(p.capacity_retention_20f_pct);
  if (!Number.isNaN(cap) && cap < 60) score += 3;
  return score;
}

/**
 * Return the culprit chain as an ordered list of node labels (Supplier, PO,
 * lot, root-cause node), or [] when the graph has no identifiable culprit.
 */
export function rootCauseChain(nodes: RcNode[], edges: RcEdge[] = []): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const bestOfType = (type: string): RcNode | undefined => {
    const ofType = nodes.filter((n) => n.type === type);
    if (ofType.length === 0) return undefined;
    let best = ofType[0];
    let bestScore = failureScore(best);
    for (const n of ofType.slice(1)) {
      const s = failureScore(n);
      if (s > bestScore) {
        best = n;
        bestScore = s;
      }
    }
    // Nothing scored → no identifiable culprit of this type.
    return bestScore > 0 ? best : undefined;
  };

  // Follow a relation from a node to a neighbor of the wanted type (undirected).
  const followFrom = (startId: string, relation: string, targetType: string): RcNode | undefined => {
    for (const e of edges) {
      if (e.relation !== relation) continue;
      const other = e.source_id === startId ? e.target_id : e.target_id === startId ? e.source_id : undefined;
      if (!other) continue;
      const node = byId.get(other);
      if (node?.type === targetType) return node;
    }
    return undefined;
  };

  // The offending lot is the strongest failure signal in the supply chain.
  const lot = bestOfType("ComponentLot");
  const supplier =
    (lot && followFrom(lot.id, "SUPPLIED_BY", "Supplier")) ??
    bestOfType("Supplier") ??
    nodes.find((n) => n.type === "Supplier");
  const po =
    (lot && followFrom(lot.id, "SOURCED_VIA", "PurchaseOrder")) ??
    nodes.find((n) => n.type === "PurchaseOrder");
  // A RootCause-typed node IS the declared root cause (e.g. energy's "Thermal
  // Overload"), so name it whenever present — type is the signal, no score needed.
  const rootCause =
    (lot && followFrom(lot.id, "ROOT_CAUSED_BY", "RootCause")) ??
    bestOfType("RootCause") ??
    nodes.find((n) => n.type === "RootCause");

  const target = supplier ?? po ?? lot ?? rootCause;
  if (!target) return [];
  const parts = [target.label];
  if (po && po !== target) parts.push(po.label);
  if (lot && lot !== target && lot !== po) parts.push(lot.label);
  if (rootCause && rootCause !== target) parts.push(rootCause.label);
  return parts;
}
