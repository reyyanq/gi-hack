/**
 * Ontology seed — placeholder.
 * Full implementation in the ingestion pipeline plan.
 * See: docs/superpowers/plans/2026-06-05-leadgraph-ingestion.md
 */

export interface SeedSummary {
  constraintsCreated: number;
  applicationAreas: number;
  companiesSeeded: number;
  productsSeeded: number;
  relationshipsCreated: number;
}

export async function seedGraph(): Promise<SeedSummary> {
  throw new Error(
    "Ingestion pipeline not yet implemented. " +
    "Run the implementation plan from docs/superpowers/plans/2026-06-05-leadgraph-comprehensive-plan.md"
  );
}
