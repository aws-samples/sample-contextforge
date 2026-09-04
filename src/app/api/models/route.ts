import { NextResponse } from "next/server";
import { MODEL_REGISTRY, DEFAULT_MODEL_ID, bedrockGenerationEnabled } from "@/lib/models";

/**
 * GET /api/models — the model registry for the picker (Gap 3).
 * Returns display fields + whether real Bedrock generation is active.
 */
export async function GET() {
  return NextResponse.json({
    models: MODEL_REGISTRY.map(({ id, label, provider, badge, color }) => ({ id, label, provider, badge, color })),
    default: DEFAULT_MODEL_ID,
    generation: bedrockGenerationEnabled() ? "bedrock" : "simulated",
  });
}
