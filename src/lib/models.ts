/**
 * Model registry (Gap 3) — "model agnostic: query the same context layer with
 * the model of your choice."
 *
 * The registry is the single source of truth for which models the UI offers and
 * which Bedrock model ID each maps to. Selecting a model flows through the query
 * route into answer synthesis. In Modes 1–2 (or without Bedrock access) the
 * switch is real but the synthesis is simulated with the chosen model's name; the
 * moment Bedrock is reachable, the same selection drives a real InvokeModel call.
 *
 * The point the post makes: the *context layer* is model-agnostic — the graph,
 * ontology, and retrieval don't change when you swap models.
 */

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  /** Bedrock model ID or cross-region inference profile. */
  bedrockId: string;
  badge: string;
  color: string;
}

// bedrockId values are cross-region INFERENCE PROFILE ids (the "us." prefix).
// The newer Bedrock models reject raw on-demand model ids and require an
// inference profile.
export const MODEL_REGISTRY: ModelOption[] = [
  { id: "claude-sonnet", label: "Claude Sonnet 4.5", provider: "Anthropic", bedrockId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0", badge: "Recommended", color: "text-amber-400" },
  { id: "claude-haiku", label: "Claude Haiku 4.5", provider: "Anthropic", bedrockId: "us.anthropic.claude-haiku-4-5-20251001-v1:0", badge: "Fast", color: "text-emerald-400" },
  { id: "nova-pro", label: "Nova Pro", provider: "Amazon", bedrockId: "us.amazon.nova-pro-v1:0", badge: "Cost-effective", color: "text-blue-400" },
  { id: "llama", label: "Llama 3.3 70B", provider: "Meta", bedrockId: "us.meta.llama3-3-70b-instruct-v1:0", badge: "Open weights", color: "text-cyan-400" },
  { id: "llama4", label: "Llama 4 Maverick", provider: "Meta", bedrockId: "us.meta.llama4-maverick-17b-instruct-v1:0", badge: "Newest", color: "text-purple-400" },
  { id: "pixtral", label: "Pixtral Large", provider: "Mistral", bedrockId: "us.mistral.pixtral-large-2502-v1:0", badge: "Multimodal", color: "text-rose-400" },
];

export const DEFAULT_MODEL_ID = process.env.DEFAULT_MODEL_ID || "claude-sonnet";

export function resolveModel(id?: string): ModelOption {
  return MODEL_REGISTRY.find((m) => m.id === id) ?? MODEL_REGISTRY.find((m) => m.id === DEFAULT_MODEL_ID) ?? MODEL_REGISTRY[0];
}

/** True when a real Bedrock generation call should be attempted. */
export function bedrockGenerationEnabled(): boolean {
  // Opt-in and only when a region is set. Kept off by default so the laptop demo
  // never needs AWS. Flip GENERATION_BACKEND=bedrock once model access is granted.
  return (process.env.GENERATION_BACKEND ?? "simulated").toLowerCase() === "bedrock" && !!process.env.AWS_REGION;
}
