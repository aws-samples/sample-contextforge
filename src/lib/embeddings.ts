/**
 * Embeddings — the vector half of "vector vs graph".
 *
 * Two backends behind one function so Modes 1–2 need no AWS:
 *   - "local"  (default): a deterministic hashing embedding. Zero dependency,
 *              no network, no creds. Good enough to make cosine retrieval real
 *              and to show that vector search finds *similar* chunks (shallow,
 *              single-source) — the honest foil to GraphRAG.
 *   - "titan"  (opt-in): Amazon Titan Text Embeddings V2 via Bedrock. Used when
 *              EMBEDDINGS_BACKEND=titan and AWS creds/model access are available.
 *              This is what Mode 3 / a real AWS install uses.
 *
 * The dimension is fixed so vectors are comparable regardless of backend at a
 * given setting. Switching backends means re-embedding (documented in RUNNING).
 */

const LOCAL_DIM = 256;

export function embeddingsBackend(): "local" | "titan" {
  return (process.env.EMBEDDINGS_BACKEND ?? "local").toLowerCase() === "titan" ? "titan" : "local";
}

export function embeddingDimension(): number {
  // Titan V2 default is 1024; local is LOCAL_DIM. Callers that persist vectors
  // should record which backend produced them (see chunks.embedding_backend).
  return embeddingsBackend() === "titan" ? 1024 : LOCAL_DIM;
}

/** Embed a single text. Async because the Titan path is a network call. */
export async function embed(text: string): Promise<number[]> {
  if (embeddingsBackend() === "titan") {
    try {
      return await embedTitan(text);
    } catch (err) {
      // Fail soft to local so a misconfigured AWS env never breaks the demo.
      console.warn(`Titan embedding failed, falling back to local: ${(err as Error).message}`);
      return embedLocalHashing(text);
    }
  }
  return embedLocalHashing(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map((t) => embed(t)));
}

/**
 * Deterministic hashing embedding: bag-of-token-hashes into a fixed vector,
 * L2-normalized. Not semantic like a trained model, but stable, dependency-free,
 * and sufficient for a believable cosine-similarity retrieval demo. Same text
 * always yields the same vector.
 */
export function embedLocalHashing(text: string, dim: number = LOCAL_DIM): number[] {
  const vec = new Array(dim).fill(0);
  const tokens = tokenize(text);
  for (const tok of tokens) {
    // Two independent hashes → sign + bucket (feature hashing trick).
    const h1 = hash(tok, 1);
    const h2 = hash(tok, 2);
    const bucket = h1 % dim;
    const sign = (h2 & 1) === 0 ? 1 : -1;
    vec[bucket] += sign;
    // Light bigram signal for a bit of word-order sensitivity.
  }
  return l2normalize(vec);
}

async function embedTitan(text: string): Promise<number[]> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
  const region = process.env.AWS_REGION || "us-west-2";
  const modelId = process.env.TITAN_EMBED_MODEL_ID || "amazon.titan-embed-text-v2:0";
  const client = new BedrockRuntimeClient({ region });
  const resp = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({ inputText: text.slice(0, 8000) }),
    })
  );
  const parsed = JSON.parse(new TextDecoder().decode(resp.body));
  return parsed.embedding as number[];
}

// --- math + tokenization ---

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  // Vectors are stored L2-normalized (local) — dot is cosine. Titan vectors are
  // near-unit; normalize defensively.
  return dot;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function hash(str: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function l2normalize(vec: number[]): number[] {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}
