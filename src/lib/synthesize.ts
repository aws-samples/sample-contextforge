import { resolveModel, bedrockGenerationEnabled } from "./models";
import type { Subgraph } from "./context/types";
import { rootCauseChain } from "./context/root-cause";

/**
 * Turn a traversed subgraph into a natural-language answer, using the chosen
 * model (Gap 3). Two paths behind one function:
 *   - simulated (default): a deterministic, grounded summary of the subgraph,
 *     labeled with the selected model. Proves the model switch is real and the
 *     context layer is model-agnostic, with no AWS.
 *   - bedrock (opt-in via GENERATION_BACKEND=bedrock + access): a real
 *     InvokeModel call with the subgraph as grounding.
 *
 * Either way, the *context* handed to the model is identical — that is the
 * model-agnostic point.
 */
export async function synthesizeAnswer(
  question: string,
  subgraph: Subgraph | undefined,
  modelId: string | undefined
): Promise<{ answer: string; model: string; generation: "bedrock" | "simulated" }> {
  const model = resolveModel(modelId);

  if (bedrockGenerationEnabled() && subgraph) {
    try {
      const answer = await generateWithBedrock(question, subgraph, model.bedrockId);
      return { answer, model: model.label, generation: "bedrock" };
    } catch (err) {
      // Fail soft to the simulated summary so a creds/access issue never breaks a demo.
      console.warn(`Bedrock generation failed, using simulated summary: ${(err as Error).message}`);
    }
  }

  return { answer: simulate(question, subgraph, model.label), generation: "simulated", model: model.label };
}

/** Deterministic, grounded subgraph summary — no LLM, no AWS. */
function simulate(question: string, subgraph: Subgraph | undefined, modelLabel: string): string {
  if (!subgraph || subgraph.nodes.length === 0) {
    return `[${modelLabel}] No connected facts found for: "${question}".`;
  }
  const byType = new Map<string, string[]>();
  for (const n of subgraph.nodes) {
    const arr = byType.get(n.type) ?? [];
    if (arr.length < 4) arr.push(n.label);
    byType.set(n.type, arr);
  }
  const typeLines = Array.from(byType.entries())
    .map(([type, labels]) => `${type}: ${labels.join(", ")}`)
    .join("; ");

  // Surface a couple of relationship chains to show "connected knowledge".
  const rels = subgraph.edges.slice(0, 5).map((e) => `${e.source_id} —${e.relation}→ ${e.target_id}`);

  // If the traversal reached a terminal root-cause entity (a supplier, the
  // purchase order behind it, the offending lot, or a declared root-cause node),
  // name it — that is the payoff of a multi-hop traversal versus a similarity
  // snippet. Absent these types (e.g. the OT-security graph) the line is skipped.
  const chain = rootCauseChain(subgraph.nodes, subgraph.edges);
  const rootCauseLine = chain.length ? `Root cause traced to: ${chain.join(" — via ")}.` : "";

  return [
    `[${modelLabel}] Reasoning across ${subgraph.nodeCount} connected entities and ${subgraph.edgeCount} relationships:`,
    typeLines,
    rels.length ? `Key paths: ${rels.join(" | ")}.` : "",
    rootCauseLine,
    `This answer follows the graph — tracing connected facts across sources end to end — rather than returning a single similar text chunk.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function generateWithBedrock(question: string, subgraph: Subgraph, bedrockId: string): Promise<string> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
  const region = process.env.AWS_REGION || "us-west-2";
  const client = new BedrockRuntimeClient({ region });

  const context = [
    "Entities:",
    ...subgraph.nodes.slice(0, 40).map((n) => `- ${n.label} (${n.type})`),
    "Relationships:",
    ...subgraph.edges.slice(0, 60).map((e) => `- ${e.source_id} ${e.relation} ${e.target_id}`),
  ].join("\n");

  const prompt = `You are a security analyst. Using ONLY the knowledge graph below, answer the question with the connected reasoning path (actor→technique→vulnerability→asset where relevant). Be concise.\n\nQUESTION: ${question}\n\nKNOWLEDGE GRAPH:\n${context}`;

  // Each Bedrock provider family uses a different request/response schema.
  // These are matched to the invokable us-west-2 inference profiles.
  const id = bedrockId.replace(/^(us|global)\./, ""); // strip inference-profile prefix for family detection
  let body: unknown;
  if (id.startsWith("anthropic.")) {
    body = { anthropic_version: "bedrock-2023-05-31", max_tokens: 1024, messages: [{ role: "user", content: prompt }] };
  } else if (id.startsWith("amazon.nova")) {
    body = { messages: [{ role: "user", content: [{ text: prompt }] }], inferenceConfig: { maxTokens: 1024 } };
  } else if (id.startsWith("meta.llama")) {
    body = { prompt: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`, max_gen_len: 1024, temperature: 0.2 };
  } else if (id.startsWith("mistral.")) {
    body = { messages: [{ role: "user", content: prompt }], max_tokens: 1024 };
  } else {
    // Fallback to Titan text schema.
    body = { inputText: prompt, textGenerationConfig: { maxTokenCount: 1024 } };
  }

  const resp = await client.send(
    new InvokeModelCommand({
      modelId: bedrockId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body),
    })
  );
  const parsed = JSON.parse(new TextDecoder().decode(resp.body));

  // Response shapes per family.
  if (id.startsWith("anthropic.")) return parsed.content?.[0]?.text ?? "";
  if (id.startsWith("amazon.nova")) return parsed.output?.message?.content?.[0]?.text ?? "";
  if (id.startsWith("meta.llama")) return parsed.generation ?? "";
  if (id.startsWith("mistral.")) return parsed.choices?.[0]?.message?.content ?? parsed.outputs?.[0]?.text ?? "";
  return parsed.results?.[0]?.outputText ?? parsed.outputText ?? "";
}
