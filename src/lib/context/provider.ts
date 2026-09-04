import type {
  Vertical,
  QueryMode,
  Fidelity,
  Node,
  Edge,
  GraphStats,
  QueryResult,
  MetricDef,
  MetricResult,
  OntologySchema,
  Document,
} from "./types";

/**
 * The single seam every page and API route talks to.
 *
 * Three implementations sit behind it — LocalMockProvider (Mode 1),
 * LocalOntologyProvider (Mode 2), CoaProvider (Mode 3) — selected by the
 * CONTEXT_MODE env var via getProvider(). The UI is identical across all three;
 * only the fidelity of the answer changes.
 *
 * See docs/RUNNING.md.
 */
export interface ContextProvider {
  /** Which mode is active — drives the UI's honesty badge. */
  readonly fidelity: Fidelity;

  /** Full graph for a vertical — nodes, edges, and summary stats. */
  getGraph(vertical: Vertical): Promise<{ nodes: Node[]; edges: Edge[]; stats: GraphStats }>;

  /** Summary stats only (cheaper than a full graph fetch). */
  getStats(vertical: Vertical): Promise<GraphStats>;

  /** Traversal from an entry node out to `hops`. */
  traverse(vertical: Vertical, nodeId: string, hops: number): Promise<{ nodes: Node[]; edges: Edge[] }>;

  /** Natural-language query. `graph` mode returns a subgraph (+ answer where available). */
  query(vertical: Vertical, question: string, mode: QueryMode, startNodes?: string[], model?: string): Promise<QueryResult>;

  /** Governed metrics available for this vertical (from the pack's OSI file in ontology/coa modes). */
  listMetrics(vertical: Vertical): Promise<MetricDef[]>;

  /** Compute one governed metric, e.g. blast_radius_score(assetId). */
  computeMetric(vertical: Vertical, name: string, args: Record<string, unknown>): Promise<MetricResult>;

  /** The ontology schema — classes + object properties. Drives entity typing/coloring. */
  describeSchema(vertical: Vertical): Promise<OntologySchema>;

  /** Ingested documents backing the graph. */
  listDocuments(vertical: Vertical): Promise<Document[]>;
}
