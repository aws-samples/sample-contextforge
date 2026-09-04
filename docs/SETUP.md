# Setup

Everything you need to run ContextForge after cloning — from a zero-AWS laptop
demo to a live graph in your own AWS account. Nothing is hardcoded to any
account; you supply your own values.

---

## Prerequisites

| For | You need |
|-----|----------|
| Mode 1 & 2 (local) | Node 20+, npm 10+ |
| Real Bedrock / Titan (optional) | An AWS account + a named CLI profile with Bedrock access |
| Mode 3 (Live COA) | A deployed [Context Ontology Accelerator](https://github.com/aws/context-ontology-accelerator) in your AWS account |

---

## 1. Install & run locally (Mode 1 — no AWS)

```bash
npm install
npm run db:seed        # loads the SQLite seed data (required on a fresh clone)
npm run dev            # http://localhost:3000
```

Open http://localhost:3000. The local login accepts any email/password by
default. This is Mode 1 — a real graph traversal over local seed data.

## 2. Mode 2 — local ontology reasoning (still no AWS)

```bash
npm run demo:ontology   # CONTEXT_MODE=ontology
```

Mode 2 answers are driven by the real OWL ontologies in `packs/` plus local
vector retrieval. To use **real** Bedrock embeddings/generation in Mode 2, set an
AWS profile and the two backend flips (see `.env.example`):

```bash
cp .env.example .env.local
# in .env.local: set AWS_PROFILE, AWS_REGION, EMBEDDINGS_BACKEND=titan,
#                GENERATION_BACKEND=bedrock
```

---

## 3. Mode 3 — Live COA (your AWS account)

Mode 3 runs the same UI over a real [Context Ontology
Accelerator](https://github.com/aws/context-ontology-accelerator) (Neptune graph,
OpenSearch vectors, governed metrics) that **you** deploy. High level:

### 3a. Deploy COA + install the packs

1. Deploy COA into your AWS account — follow the upstream repo, and see
   `docs/MODE3_COA.md` for region-specific notes we learned in practice.
2. Install a vertical pack into a COA namespace with the bundled installer:
   ```bash
   cd tools/coa-pack
   uv run coa-pack install ../../packs/ot-security \
     --namespace otsec --create-namespace --owner you@example.com \
     --base-url <YOUR_COA_BASE_URL> --token <A_VALID_OIDC_TOKEN>
   ```
   Repeat per vertical you want live (`packs/manufacturing` for Product Quality,
   etc.). Each install creates/uses a **namespace**; note its **UUID**.
3. (Optional) Land documents so answers have content — see
   `docs/MODE3_COA.md` "Land real data" and `connectors/sample-data/` for the
   synthetic sample documents shipped with this repo.

### 3b. Configure `.env.local`

```bash
cp .env.example .env.local
```

Fill in these (each is explained in `.env.example`):

| Variable | What it is | Where to get it |
|----------|-----------|-----------------|
| `CONTEXT_MODE=coa` | Selects Mode 3 | — |
| `COA_BASE_URL` | Your COA API invoke URL | API Gateway stage URL of your COA deploy |
| `COA_CLIENT_ID` | Cognito app client id | Your COA's Cognito user pool → app client |
| `COA_USER` / `COA_PASS` | A Cognito user in the pool (Admin group for writes) | You create it (see `docs/MODE3_COA.md`) |
| `COA_NAMESPACE_OTSEC` (etc.) | Namespace **UUID** per vertical | `GET /namespaces` on your COA, or the installer output |
| `AWS_REGION` / `AWS_PROFILE` | Region + CLI profile with account access | Your AWS setup |

> **Gotcha:** the data-plane resolves a namespace by its **UUID**, not its
> friendly name. Setting the name silently returns 0 results. Always use the UUID.

### 3c. Run it

```bash
npm run demo:coa         # mints a fresh Cognito token (~1h) & launches Mode 3
npm run demo:preflight   # verifies token, COA reachability, and seeded data
```

Open the Query Playground, pick a vertical, and run a question — you'll see live
Vector RAG (OpenSearch) vs GraphRAG (Neptune) side by side.

---

## 4. Configuration reference

| Concern | File |
|---------|------|
| All env vars, annotated | `.env.example` |
| Token mint + launch | `scripts/demo-coa.sh` (`npm run demo:coa`) |
| Readiness check | `scripts/demo-preflight.sh` (`npm run demo:preflight`) |
| Deploy the app (App Runner) | `docs/DEPLOY_PUBLIC.md` |
| COA deploy specifics | `docs/MODE3_COA.md` |
| Exercising the three modes | `docs/TESTING_MODES.md` |

---

## Security notes for forks

- **Never commit `.env.local`** — it's gitignored. All secrets (Cognito password,
  tokens, app login) belong there or in a secrets manager, never in tracked files.
- For a hosted deployment, store `COA_USER`/`COA_PASS`/`DEMO_PASS`/`AUTH_SECRET`
  in a secrets manager and inject them as runtime env, not in the image.
- Rotate any credential that has ever been committed before making a repo public.
