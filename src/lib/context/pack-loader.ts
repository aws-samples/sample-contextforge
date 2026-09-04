import fs from "fs";
import path from "path";
import { Parser as N3Parser, type Quad } from "n3";
import { parse as parseYaml } from "yaml";
import type { OntologyClass, OntologyProperty, OntologySchema, MetricDef } from "./types";

/**
 * Loads the vertical packs (packs/<name>/) — the same ontology.ttl and
 * metrics.osi.yaml files that install into COA in Mode 3. Here they drive the
 * local reasoner in Mode 2, so the demo runs on a real W3C ontology with no AWS.
 */

const OWL = "http://www.w3.org/2002/07/owl#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const SKOS = "http://www.w3.org/2004/02/skos/core#";

/** App vertical id → pack directory name. */
export const VERTICAL_TO_PACK: Record<string, string> = {
  otsec: "ot-security",
  energy: "energy-outage",
  manufacturing: "manufacturing",
  // `cyber` has no dedicated pack — its scope overlaps ot-security. Map it to
  // ot-security so Mode 2 still resolves.
  cyber: "ot-security",
  // `prodquality` (drill-bit root-cause story) reuses the manufacturing pack:
  // its OWL ontology already models Supplier / ComponentLot / Component /
  // Product / DefectType genealogy with the transitive `derivedFrom` relation —
  // exactly the supply-chain root-cause reasoning the drill story needs. No
  // parallel ontology to maintain; Mode 2 resolves against a real W3C ontology.
  prodquality: "manufacturing",
};

/** The transitive object property each pack is built around (blast-radius style derivation). */
export const TRANSITIVE_PROPERTY: Record<string, string> = {
  "ot-security": "canReach",
  "energy-outage": "feeds",
  manufacturing: "derivedFrom",
};

export interface LoadedPack {
  packName: string;
  schema: OntologySchema;
  metrics: MetricDef[];
  transitiveProperty: string;
}

const _cache = new Map<string, LoadedPack>();

function packsDir(): string {
  return path.join(process.cwd(), "packs");
}

function localName(iri: string): string {
  const hash = iri.lastIndexOf("#");
  const slash = iri.lastIndexOf("/");
  return iri.slice(Math.max(hash, slash) + 1);
}

export function loadPack(vertical: string): LoadedPack {
  const packName = VERTICAL_TO_PACK[vertical] ?? vertical;
  const cached = _cache.get(packName);
  if (cached) return cached;

  const dir = path.join(packsDir(), packName);
  const ttl = fs.readFileSync(path.join(dir, "ontology.ttl"), "utf8");
  const schema = parseOntology(vertical, packName, ttl);

  const osiPath = path.join(dir, "metrics.osi.yaml");
  const metrics = fs.existsSync(osiPath) ? parseMetrics(fs.readFileSync(osiPath, "utf8")) : [];

  const loaded: LoadedPack = {
    packName,
    schema,
    metrics,
    transitiveProperty: TRANSITIVE_PROPERTY[packName] ?? "canReach",
  };
  _cache.set(packName, loaded);
  return loaded;
}

function parseOntology(vertical: string, packName: string, ttl: string): OntologySchema {
  const parser = new N3Parser();
  const quads: Quad[] = parser.parse(ttl);

  const classIris = new Set<string>();
  const propIris = new Set<string>();
  const transitiveProps = new Set<string>();
  const labels = new Map<string, string>();
  const comments = new Map<string, string>();
  const subClassOf = new Map<string, string>();
  const domain = new Map<string, string>();
  const range = new Map<string, string>();
  const altLabels = new Map<string, string[]>();

  for (const q of quads) {
    const s = q.subject.value;
    const p = q.predicate.value;
    const o = q.object.value;

    if (p === `${RDF}type`) {
      if (o === `${OWL}Class`) classIris.add(s);
      if (o === `${OWL}ObjectProperty`) propIris.add(s);
      if (o === `${OWL}TransitiveProperty`) transitiveProps.add(s);
    } else if (p === `${RDFS}label`) {
      labels.set(s, o);
    } else if (p === `${RDFS}comment`) {
      comments.set(s, o);
    } else if (p === `${RDFS}subClassOf`) {
      subClassOf.set(s, localName(o));
    } else if (p === `${RDFS}domain`) {
      domain.set(s, localName(o));
    } else if (p === `${RDFS}range`) {
      range.set(s, localName(o));
    } else if (p === `${SKOS}altLabel`) {
      const arr = altLabels.get(s) ?? [];
      arr.push(o);
      altLabels.set(s, arr);
    }
  }

  const classes: OntologyClass[] = Array.from(classIris).map((iri) => ({
    id: localName(iri),
    label: labels.get(iri) ?? localName(iri),
    comment: comments.get(iri),
    subClassOf: subClassOf.get(iri),
    altLabels: altLabels.get(iri),
  }));

  const properties: OntologyProperty[] = Array.from(propIris).map((iri) => ({
    id: localName(iri),
    label: labels.get(iri) ?? localName(iri),
    domain: domain.get(iri),
    range: range.get(iri),
    transitive: transitiveProps.has(iri),
    comment: comments.get(iri),
  }));

  return {
    vertical,
    source: `ontology.ttl (${packName} pack)`,
    classes: classes.sort((a, b) => a.label.localeCompare(b.label)),
    properties: properties.sort((a, b) => a.label.localeCompare(b.label)),
  };
}

function parseMetrics(osi: string): MetricDef[] {
  const doc = parseYaml(osi) as { metrics?: Array<Record<string, unknown>> };
  const metrics = doc?.metrics ?? [];
  return metrics.map((m) => {
    const xcoa = (m.x_coa ?? {}) as Record<string, unknown>;
    return {
      name: String(m.name),
      description: String(m.description ?? "").trim(),
      unit: xcoa.return_type ? String(xcoa.return_type) : undefined,
      // Metrics that reason over the transitive property take an entry node.
      args: Array.isArray(xcoa.ontology_concepts) ? ["nodeId"] : undefined,
    };
  });
}
