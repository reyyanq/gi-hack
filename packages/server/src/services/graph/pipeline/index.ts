
import { runQuery, queryRows } from "../neo4j.js";
import {
  PipelineLead,
  ActivityNote,
  StartPipelineInput,
  AddNoteInput,
  PipelineSummary,
  PIPELINE_STAGES,
  PipelineStage,
} from "./types.js";

function nowISO(): string {
  return new Date().toISOString();
}

function mapRowToLead(row: any): PipelineLead {
  return {
    id: row.id,
    contactName: row.contactName,
    email: row.email ?? undefined,
    role: row.role ?? undefined,
    companyName: row.companyName,
    companyDomain: row.companyDomain ?? undefined,
    companyTier: row.companyTier ?? undefined,
    companyScore: row.companyScore ?? undefined,
    stage: row.stage as PipelineStage,
    stageEnteredAt: row.stageEnteredAt,
    notes: [],
  };
}

function mapRowToNote(row: any): ActivityNote {
  return {
    id: row.id,
    type: row.type as ActivityNote["type"],
    note: row.note,
    date: row.date,
    createdBy: row.createdBy ?? undefined,
  };
}

// ── POST /api/pipeline/start ─────────────────────────────────

export async function startPipeline(input: StartPipelineInput): Promise<PipelineLead> {
  const { companyName, contactName, email, role } = input;
  const now = nowISO();

  // Check company exists — queryRows returns plain array
  const companyCheck = await queryRows(
    `MATCH (c:Company {name: $companyName}) RETURN c.name AS name LIMIT 1`,
    { companyName }
  );
  if (companyCheck.length === 0) {
    throw new Error(`Company "${companyName}" not found. Run ingest:seed first.`);
  }

  const rows = await queryRows(
    `MATCH (company:Company {name: $companyName})
     CREATE (contact:Contact {
       name: $contactName,
       email: $email,
       role: $role,
       createdAt: $now
     })
     CREATE (stage:PipelineStage {
       stage: $stage,
       enteredAt: $now
     })
     CREATE (activity:Activity {
       type: "STAGE_CHANGE",
       note: $activityNote,
       date: $now
     })
     MERGE (contact)-[:CONTACT_AT]->(company)
     MERGE (contact)-[:IN_STAGE]->(stage)
     MERGE (contact)-[:HAS_ACTIVITY]->(activity)
     RETURN
       elementId(contact)   AS id,
       contact.name         AS contactName,
       contact.email        AS email,
       contact.role         AS role,
       company.name         AS companyName,
       company.domain       AS companyDomain,
       company.tier         AS companyTier,
       company.score        AS companyScore,
       stage.stage          AS stage,
       stage.enteredAt      AS stageEnteredAt`,
    {
      companyName,
      contactName,
      email: email ?? null,
      role: role ?? null,
      stage: "New",
      activityNote: `Lead entered pipeline — Stage: New`,
      now,
    }
  );

  if (rows.length === 0) throw new Error("Failed to create pipeline lead");
  return mapRowToLead(rows[0]);
}

// ── GET /api/pipeline/leads ───────────────────────────────────

export async function getPipelineLeads(): Promise<PipelineLead[]> {
  const rows = await queryRows(
    `MATCH (contact:Contact)-[:IN_STAGE]->(stage:PipelineStage)
     MATCH (contact)-[:CONTACT_AT]->(company:Company)
     OPTIONAL MATCH (contact)-[:HAS_ACTIVITY]->(activity:Activity)
     WITH contact, stage, company,
          collect({
            id:   elementId(activity),
            type: activity.type,
            note: activity.note,
            date: activity.date
          }) AS activities
     RETURN
       elementId(contact)   AS id,
       contact.name         AS contactName,
       contact.email        AS email,
       contact.role         AS role,
       company.name         AS companyName,
       company.domain       AS companyDomain,
       company.tier         AS companyTier,
       company.score        AS companyScore,
       stage.stage          AS stage,
       stage.enteredAt      AS stageEnteredAt,
       activities           AS notes
     ORDER BY stage.enteredAt DESC`
  );

  return rows.map((row) => ({
    ...mapRowToLead(row),
    notes: (row.notes ?? [])
      .filter((n: any) => n.id !== null)
      .map(mapRowToNote),
  }));
}

// ── PUT /api/pipeline/:id/advance ────────────────────────────

export async function advanceStage(
  contactId: string,
  targetStage?: PipelineStage
): Promise<PipelineLead> {
  const now = nowISO();

  const current = await queryRows(
    `MATCH (contact:Contact)-[:IN_STAGE]->(stage:PipelineStage)
     WHERE elementId(contact) = $contactId
     RETURN stage.stage AS currentStage`,
    { contactId }
  );

  if (current.length === 0) throw new Error(`Lead "${contactId}" not found`);

  const currentStage = current[0].currentStage as PipelineStage;
  const currentIndex = PIPELINE_STAGES.indexOf(currentStage);

  let nextStage: PipelineStage;
  if (targetStage) {
    nextStage = targetStage;
  } else {
    const nextIndex = Math.min(currentIndex + 1, PIPELINE_STAGES.indexOf("Closed Won"));
    nextStage = PIPELINE_STAGES[nextIndex];
  }

  if (nextStage === currentStage) throw new Error(`Already at stage "${currentStage}"`);

  const rows = await queryRows(
    `MATCH (contact:Contact)-[r:IN_STAGE]->(oldStage:PipelineStage)
     WHERE elementId(contact) = $contactId
     MATCH (contact)-[:CONTACT_AT]->(company:Company)
     DELETE r, oldStage
     CREATE (newStage:PipelineStage { stage: $nextStage, enteredAt: $now })
     CREATE (activity:Activity { type: "STAGE_CHANGE", note: $activityNote, date: $now })
     MERGE (contact)-[:IN_STAGE]->(newStage)
     MERGE (contact)-[:HAS_ACTIVITY]->(activity)
     RETURN
       elementId(contact)   AS id,
       contact.name         AS contactName,
       contact.email        AS email,
       contact.role         AS role,
       company.name         AS companyName,
       company.domain       AS companyDomain,
       company.tier         AS companyTier,
       company.score        AS companyScore,
       newStage.stage       AS stage,
       newStage.enteredAt   AS stageEnteredAt`,
    {
      contactId,
      nextStage,
      activityNote: `Stage changed: ${currentStage} → ${nextStage}`,
      now,
    }
  );

  if (rows.length === 0) throw new Error("Failed to advance stage");
  return mapRowToLead(rows[0]);
}

// ── POST /api/pipeline/:id/notes ─────────────────────────────

export async function addNote(input: AddNoteInput): Promise<ActivityNote> {
  const { contactId, note, type = "NOTE" } = input;
  const now = nowISO();

  const rows = await queryRows(
    `MATCH (contact:Contact)
     WHERE elementId(contact) = $contactId
     CREATE (activity:Activity { type: $type, note: $note, date: $now })
     MERGE (contact)-[:HAS_ACTIVITY]->(activity)
     RETURN
       elementId(activity) AS id,
       activity.type       AS type,
       activity.note       AS note,
       activity.date       AS date`,
    { contactId, type, note, now }
  );

  if (rows.length === 0) throw new Error("Failed to add note");
  return mapRowToNote(rows[0]);
}

// ── GET /api/pipeline/:id/activity ───────────────────────────

export async function getActivity(contactId: string): Promise<ActivityNote[]> {
  const rows = await queryRows(
    `MATCH (contact:Contact)-[:HAS_ACTIVITY]->(activity:Activity)
     WHERE elementId(contact) = $contactId
     RETURN
       elementId(activity) AS id,
       activity.type       AS type,
       activity.note       AS note,
       activity.date       AS date
     ORDER BY activity.date DESC`,
    { contactId }
  );

  return rows.map(mapRowToNote);
}

// ── GET /api/pipeline/summary ─────────────────────────────────

export async function getPipelineSummary(): Promise<PipelineSummary> {
  const rows = await queryRows(
    `MATCH (contact:Contact)-[:IN_STAGE]->(stage:PipelineStage)
     RETURN stage.stage AS stage, count(contact) AS count`
  );

  const byStage = Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s, 0])
  ) as Record<PipelineStage, number>;

  for (const row of rows) {
    if (row.stage in byStage) {
      byStage[row.stage as PipelineStage] = Number(row.count);
    }
  }

  const totalLeads = Object.values(byStage).reduce((a, b) => a + b, 0);
  return { totalLeads, byStage };
}

export * from "./types.js";
