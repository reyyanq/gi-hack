import { runQuery } from "../neo4j.js";

const STAGES = ["New", "Contacted", "Meeting", "Proposal", "Closed Won", "Closed Lost"] as const;
export type PipelineStage = (typeof STAGES)[number];

export interface PipelineLead {
  companyName: string;
  companyDomain?: string;
  companySegment?: string;
  companyDescription?: string;
  contacts: ContactSummary[];
  currentStage: PipelineStage;
  lastActivity?: string;
}

export interface ContactSummary {
  id: string;
  name: string;
  email?: string;
  role?: string;
  stage: string;
  enteredAt: string;
}

export interface ActivityEntry {
  id: string;
  type: string;
  note: string;
  date: string;
}

export { STAGES };

export async function ensurePipelineStages(): Promise<void> {
  await runQuery(
    `UNWIND $stages AS stageName
     MERGE (s:PipelineStage {name: stageName})`,
    { stages: STAGES }
  );
}

export async function startPipeline(companyName: string, contactName?: string, contactEmail?: string, contactRole?: string): Promise<{ contactId: string }> {
  const result = await runQuery(
    `MATCH (c:Company)
     WHERE c.name = $companyName OR c.normalizedName = $normName
     WITH c LIMIT 1
     MERGE (contact:Contact {email: $email})
     ON CREATE SET contact.id = randomUUID(), contact.name = $contactName, contact.role = $role
     MERGE (contact)-[:CONTACT_AT]->(c)
     WITH contact
     MATCH (s:PipelineStage {name: "New"})
     MERGE (contact)-[r:IN_STAGE]->(s)
     SET r.enteredAt = toString(datetime())
     RETURN contact.id AS contactId`,
    {
      companyName,
      normName: companyName.toLowerCase().replace(/[^a-z0-9]/g, ""),
      contactName: contactName ?? `Contact at ${companyName}`,
      email: contactEmail ?? `${contactName}@${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      role: contactRole ?? null,
    }
  );

  const contactId = (result.records?.[0] as any)?.contactId;
  if (!contactId) throw new Error(`Company "${companyName}" not found in graph`);
  return { contactId };
}

export async function advanceStage(contactId: string): Promise<{ newStage: string }> {
  const current = await runQuery(
    `MATCH (c:Contact {id: $contactId})-[r:IN_STAGE]->(s:PipelineStage)
     RETURN s.name AS stage, r.enteredAt AS enteredAt`,
    { contactId }
  );

  const currentStage = (current.records?.[0] as any)?.stage;
  if (!currentStage) throw new Error(`Contact "${contactId}" is not in a pipeline stage`);

  const idx = STAGES.indexOf(currentStage);
  if (idx === -1) throw new Error(`Unknown stage "${currentStage}"`);
  if (idx >= STAGES.length - 2) throw new Error("Already at final stage — cannot advance further");

  const nextStage = STAGES[idx + 1];

  await runQuery(
    `MATCH (c:Contact {id: $contactId})-[r:IN_STAGE]->(s:PipelineStage)
     DELETE r
     WITH c
     MATCH (next:PipelineStage {name: $nextStage})
     MERGE (c)-[:IN_STAGE {enteredAt: toString(datetime())}]->(next)`,
    { contactId, nextStage }
  );

  return { newStage: nextStage };
}

export async function regressStage(contactId: string, targetStage: string): Promise<{ newStage: string }> {
  if (!STAGES.includes(targetStage as PipelineStage)) {
    throw new Error(`Invalid stage "${targetStage}". Valid: ${STAGES.join(", ")}`);
  }

  await runQuery(
    `MATCH (c:Contact {id: $contactId})-[r:IN_STAGE]->(s:PipelineStage)
     DELETE r
     WITH c
     MATCH (next:PipelineStage {name: $targetStage})
     MERGE (c)-[:IN_STAGE {enteredAt: toString(datetime())}]->(next)`,
    { contactId, targetStage }
  );

  return { newStage: targetStage };
}

export async function addActivity(contactId: string, type: string, note: string): Promise<{ activityId: string }> {
  const result = await runQuery(
    `MATCH (c:Contact {id: $contactId})
     CREATE (a:Activity {
       id: randomUUID(),
       type: $type,
       note: $note,
       date: toString(datetime())
     })
     MERGE (c)-[:HAS_ACTIVITY]->(a)
     RETURN a.id AS activityId`,
    { contactId, type, note }
  );

  const activityId = (result.records?.[0] as any)?.activityId;
  if (!activityId) throw new Error(`Contact "${contactId}" not found`);
  return { activityId };
}

export async function getPipelineLeads(): Promise<PipelineLead[]> {
  const result = await runQuery(
    `MATCH (contact:Contact)-[:CONTACT_AT]->(company:Company)
     OPTIONAL MATCH (contact)-[stageRel:IN_STAGE]->(stage:PipelineStage)
     OPTIONAL MATCH (contact)-[:HAS_ACTIVITY]->(a:Activity)
     WITH contact, company, stageRel, stage, a
     ORDER BY a.date DESC
     WITH contact, company, stageRel, stage, collect(a)[0] AS latestActivity
     RETURN company.name AS companyName,
            company.domain AS companyDomain,
            company.segment AS companySegment,
            company.description AS companyDescription,
            contact.id AS contactId,
            contact.name AS contactName,
            contact.email AS contactEmail,
            contact.role AS contactRole,
            stage.name AS currentStage,
            stageRel.enteredAt AS enteredAt,
            latestActivity.date AS lastActivity,
            latestActivity.note AS lastActivityNote,
            latestActivity.type AS lastActivityType
     ORDER BY stageRel.enteredAt DESC`
  );

  const rows = result.records ?? [];
  const companyMap = new Map<string, PipelineLead>();

  for (const row of rows) {
    const r = row as any;
    const name = r.companyName as string;

    if (!companyMap.has(name)) {
      companyMap.set(name, {
        companyName: name,
        companyDomain: r.companyDomain ?? undefined,
        companySegment: r.companySegment ?? undefined,
        companyDescription: r.companyDescription ?? undefined,
        contacts: [],
        currentStage: (r.currentStage ?? "New") as PipelineStage,
        lastActivity: r.lastActivity ?? undefined,
      });
    }

    const entry = companyMap.get(name)!;

    const contactId = r.contactId as string;
    if (!entry.contacts.some((c) => c.id === contactId)) {
      entry.contacts.push({
        id: contactId,
        name: r.contactName ?? "Unknown",
        email: r.contactEmail ?? undefined,
        role: r.contactRole ?? undefined,
        stage: (r.currentStage ?? "New") as PipelineStage,
        enteredAt: r.enteredAt ?? new Date().toISOString(),
      });
    }

    if (r.lastActivity && (!entry.lastActivity || r.lastActivity > entry.lastActivity)) {
      entry.lastActivity = r.lastActivity;
    }
  }

  return Array.from(companyMap.values());
}

export async function getContactActivity(contactId: string): Promise<ActivityEntry[]> {
  const result = await runQuery(
    `MATCH (c:Contact {id: $contactId})-[:HAS_ACTIVITY]->(a:Activity)
     RETURN a.id AS id, a.type AS type, a.note AS note, a.date AS date
     ORDER BY a.date DESC`,
    { contactId }
  );

  return (result.records ?? []).map((r: any) => ({
    id: r.id as string,
    type: r.type as string,
    note: r.note as string,
    date: r.date as string,
  }));
}
