

import { createDriver, closeDriver } from '../services/graph/neo4j.js';
import { runQuery } from '../services/graph/neo4j.js';
import { startPipeline, addActivity, ensurePipelineStages } from '../services/graph/pipeline/index.js';

const STAGES = ['New', 'Contacted', 'Meeting', 'Proposal', 'Closed Won', 'Closed Lost'] as const;
const ACTIVITY_TYPES = ['NOTE', 'EMAIL', 'CALL', 'MEETING', 'STAGE_CHANGE'] as const;

interface DemoLead {
  companyName: string;
  contactName: string;
  email: string;
  role: string;
  initialStage: typeof STAGES[number];
  activities: ActivityTemplate[];
}

interface ActivityTemplate {
  type: typeof ACTIVITY_TYPES[number];
  note: string;
  daysOffset: number;
}

const DEMO_LEADS: DemoLead[] = [
  {
    companyName: 'BioTech Solutions GmbH',
    contactName: 'Dr. Anna Müller',
    email: 'a.mueller@biotech-solutions.de',
    role: 'R&D Director',
    initialStage: 'New',
    activities: [
      { type: 'NOTE', note: 'Strong signals detected - recent FDA 510(k) clearance for Factor VII kit', daysOffset: -1 }
    ]
  },
  {
    companyName: 'Diagnostic Systems AG',
    contactName: 'Markus Wagner',
    email: 'm.wagner@diagnostic-systems.de',
    role: 'Head of Assay Development',
    initialStage: 'New',
    activities: [
      { type: 'NOTE', note: 'HOT tier lead - portfolio match: 14 items for hemostasis applications', daysOffset: -2 }
    ]
  },
  {
    companyName: 'MedLab Innovations',
    contactName: 'Dr. Sophie Weber',
    email: 's.weber@medlab-innovations.de',
    role: 'CTO',
    initialStage: 'Contacted',
    activities: [
      { type: 'EMAIL', note: 'Initial outreach sent - cited their recent clinical trial on innovative coagulation assays', daysOffset: -7 },
      { type: 'EMAIL', note: 'Received positive response - interested in sample validation kit', daysOffset: -5 },
      { type: 'NOTE', note: 'Research confirms: strong fit for Plasma Proteins portfolio - 12 matching items', daysOffset: -4 }
    ]
  },
  {
    companyName: 'IVD Analytics GmbH',
    contactName: 'Thomas Fischer',
    email: 't.fischer@ivd-analytics.de',
    role: 'Director of Diagnostics',
    initialStage: 'Contacted',
    activities: [
      { type: 'EMAIL', note: 'Outreach highlighting their recent patent flow for point-of-care testing', daysOffset: -10 },
      { type: 'EMAIL', note: 'Replied - scheduled technical call for next week', daysOffset: -8 },
      { type: 'NOTE', note: 'Competitor analysis: our lead times significantly shorter than current vendor', daysOffset: -7 }
    ]
  },
  {
    companyName: 'HemoDiagnostics SE',
    contactName: 'Dr. Julia Schmidt',
    email: 'j.schmidt@hemodiagnostics.de',
    role: 'VP R&D',
    initialStage: 'Meeting',
    activities: [
      { type: 'EMAIL', note: 'Initial outreach - strong portfolio match (19 items)', daysOffset: -21 },
      { type: 'EMAIL', note: 'Confirmed interest in technical validation meeting', daysOffset: -19 },
      { type: 'MEETING', note: 'Technical validation call - discussed Factor VIII and IX bulk protein needs', daysOffset: -15 },
      { type: 'EMAIL', note: 'Sample validation kit shipped via DHL Express - Tracking: DE123456789', daysOffset: -13 },
      { type: 'NOTE', note: 'Customer considering 5-year partnership to secure supply for clinical trials', daysOffset: -10 },
      { type: 'MEETING', note: 'Follow-up call - preliminary feedback on samples positive, discussing volume requirements', daysOffset: -5 },
      { type: 'NOTE', note: 'Pricing competitive vs Abcam and Bio-Rad - projecting €47k annual volume', daysOffset: -3 }
    ]
  },
  {
    companyName: 'Coagulation Technologies',
    contactName: 'Michael Klein',
    email: 'm.klein@coagulation-tech.de',
    role: 'Product Lead',
    initialStage: 'Meeting',
    activities: [
      { type: 'EMAIL', note: 'Outreach based on clinical trial signal - Phase 3 study on novel anticoagulant testing', daysOffset: -18 },
      { type: 'EMAIL', note: 'Expressed interest - requested technical documentation', daysOffset: -16 },
      { type: 'MEETING', note: 'Discovery call - explained our bulk antibody production capabilities', daysOffset: -12 },
      { type: 'EMAIL', note: 'Sent technical spec sheet and Certificate of Analysis sample', daysOffset: -10 },
      { type: 'NOTE', note: 'Portfolio cross-sell identified: 8 latex particle products also relevant', daysOffset: -8 },
      { type: 'MEETING', note: 'Production site visit scheduled - Marburg facilities tour', daysOffset: -4 }
    ]
  },
  {
    companyName: 'Precision Assays GmbH',
    contactName: 'Dr. Nora Hoffmann',
    email: 'n.hoffmann@precision-assays.de',
    role: 'Chief Scientific Officer',
    initialStage: 'Proposal',
    activities: [
      { type: 'EMAIL', note: 'Initial outreach - strong WARM tier, good fit for blockers portfolio', daysOffset: -35 },
      { type: 'EMAIL', note: 'Technical discussions ongoing - interested in custom formulation', daysOffset: -32 },
      { type: 'MEETING', note: 'Technical meeting with R&D team - discussed assay optimization parameters', daysOffset: -28 },
      { type: 'MEETING', note: 'Business meeting with procurement - introduced 5-year contract option', daysOffset: -21 },
      { type: 'EMAIL', note: 'Draft proposal sent - €38k/year initial volume, scaling to €75k by year 3', daysOffset: -15 },
      { type: 'NOTE', note: 'Competing with ThermoFisher - our pricing 15% lower for comparable quality', daysOffset: -12 },
      { type: 'MEETING', note: 'Proposal review call - customer feedback overall positive, negotiating payment terms', daysOffset: -7 },
      { type: 'NOTE', note: 'Added flexible shipping option (monthly vs quarterly) to addresscash flow concern', daysOffset: -5 }
    ]
  },
  {
    companyName: 'BioSynthetica AG',
    contactName: 'Alexander Braun',
    email: 'a.braun@biosynthetica.de',
    role: 'Lead Scientist',
    initialStage: 'Closed Won',
    activities: [
      { type: 'EMAIL', note: 'Outreach - HOT tier, 17 portfolio matches identified', daysOffset: -60 },
      { type: 'EMAIL', note: 'Quick response - urgent need for Factor VII bulk protein', daysOffset: -58 },
      { type: 'MEETING', note: 'Emergency technical call - confirmed supply availability for 500g batch', daysOffset: -56 },
      { type: 'EMAIL', note: 'Sample rush-ordered via same-day courier - customer testing 48h later', daysOffset: -55 },
      { type: 'NOTE', note: 'Test results successful - customer ready to proceed with order', daysOffset: -52 },
      { type: 'MEETING', note: 'Contract signing - 3-year agreement with annual escalation clause', daysOffset: -45 },
      { type: 'EMAIL', note: 'Welcome email sent - onboarding documents and account setup', daysOffset: -44 },
      { type: 'NOTE', note: 'Initial order confirmed: 3 bulk proteins, 12 antibodies, 8 blockers', daysOffset: -42 },
      { type: 'EMAIL', note: 'First shipment dispatched - delivery confirmed, customer delighted', daysOffset: -38 },
      { type: 'NOTE', note: 'Customer reported 99.8% assay success rate vs 94.5% with previous vendor', daysOffset: -30 },
      { type: 'MEETING', note: 'QBR schedule established - quarterly review with procurement and R&D', daysOffset: -20 },
      { type: 'NOTE', note: 'Upsell opportunity: customer expressed interest in latex particle portfolio', daysOffset: -15 }
    ]
  },
  {
    companyName: 'TestBuffer Systems',
    contactName: 'Dr. Katharina Wolf',
    email: 'k.wolf@testbuffer.de',
    role: 'Director of Quality',
    initialStage: 'Closed Lost',
    activities: [
      { type: 'EMAIL', note: 'Initial outreach based on HEMA conference attendance signal', daysOffset: -40 },
      { type: 'EMAIL', note: 'Received polite decline - evaluating multiple vendors', daysOffset: -38 },
      { type: 'CALL', note: 'Follow-up call - customer requested more time for decision', daysOffset: -36 },
      { type: 'NOTE', note: 'Sent competitive comparison highlighting our ISO 13485 certification', daysOffset: -35 },
      { type: 'MEETING', note: 'Final presentation to selection committee', daysOffset: -30 },
      { type: 'EMAIL', note: 'Regretfully informed they chose competitor - existing long-term relationship with Roche', daysOffset: -25 },
      { type: 'NOTE', note: 'Keep warm: re-engage in 6 months - current contract ends December 2024', daysOffset: -24 },
      { type: 'CALL', note: 'Feedback call - customer noted superior technical specs but relationship priority won', daysOffset: -20 }
    ]
  },
  {
    companyName: 'EmergentBio Innovations',
    contactName: 'Stefan Richter',
    email: 's.richter@emergentbio.de',
    role: 'Business Development',
    initialStage: 'Closed Lost',
    activities: [
      { type: 'EMAIL', note: 'Outreach cited their recent Series A funding - scaling needs identified', daysOffset: -28 },
      { type: 'EMAIL', note: 'Responded interested - requested technical samples for evaluation', daysOffset: -26 },
      { type: 'MEETING', note: 'Discovery call - enthusiastic about our rapid turnaround times', daysOffset: -22 },
      { type: 'EMAIL', note: 'Samples sent - 3 bulk protein variants for testing', daysOffset: -20 },
      { type: 'NOTE', note: 'Customer feedback: quality excellent but price point slightly above budget', daysOffset: -15 },
      { type: 'MEETING', note: 'Attempted negotiation with 10% volume discount on commitment', daysOffset: -12 },
      { type: 'EMAIL', note: 'Declined - chose smaller competitor focused on lower cost alternatives', daysOffset: -10 },
      { type: 'NOTE', note: 'Learning: startup segment price-sensitive - consider entry-level product line', daysOffset: -9 }
    ]
  }
];

// @ts-expect-error - Function exists for future use with timestamped activities
function daysToISOString(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}

async function createDemoLead(
  lead: DemoLead
): Promise<{ contactId: string; activitiesCount: number }> {
  await runQuery(
    `MERGE (c:Company {name: $name})
     ON CREATE SET c.domain = $domain, c.segment = $segment, c.tier = 'WARM'
     RETURN c`,
    {
      name: lead.companyName,
      domain: lead.email.split('@')[1],
      segment: 'IVD'
    }
  );

  const { contactId } = await startPipeline(
    lead.companyName,
    lead.contactName,
    lead.email,
    lead.role
  );

  await runQuery(
    `MATCH (contact:Contact {id: $contactId})-[r:IN_STAGE]->(s:PipelineStage)
     DELETE r
     WITH contact
     MATCH (newStage:PipelineStage {name: $targetStage})
     MERGE (contact)-[newRel:IN_STAGE {enteredAt: toString(datetime())}]->(newStage)
     RETURN newRel`,
    { contactId, targetStage: lead.initialStage }
  );

  let activitiesCount = 0;
  const sortedActivities = [...lead.activities].sort((a, b) => a.daysOffset - b.daysOffset);

  for (const activity of sortedActivities) {
    await addActivity(contactId, activity.type, activity.note);
    activitiesCount++;
  }

  return { contactId, activitiesCount };
}

async function main() {
  console.log('Creating demo pipeline data...\n');

  const NEO4J_URI = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
  const NEO4J_USER = process.env.NEO4J_USER ?? 'neo4j';
  const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? 'password';

  createDriver({ uri: NEO4J_URI, user: NEO4J_USER, password: NEO4J_PASSWORD });

  try {
    await runQuery('RETURN 1').catch(() => {
      throw new Error('Failed to connect to Neo4j. Is it running?');
    });

    console.log('Ensuring pipeline stages...');
    await ensurePipelineStages();

    console.log(`\nCreating ${DEMO_LEADS.length} demo leads...\n`);

    let totalActivities = 0;
    const createdLeads: Array<{ name: string; stage: string; activities: number }> = [];

    for (const lead of DEMO_LEADS) {
      process.stdout.write(`  Creating: ${lead.companyName} (${lead.initialStage})... `);

      try {
        const result = await createDemoLead(lead);
        console.log(`✓ (${result.activitiesCount} activities)`);
        totalActivities += result.activitiesCount;
        createdLeads.push({
          name: lead.companyName,
          stage: lead.initialStage,
          activities: result.activitiesCount
        });
      } catch (error: any) {
        console.log(`✗ ${error.message}`);
        throw error;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Demo pipeline creation complete!\n');
    console.log(`   Leads created: ${createdLeads.length}`);
    console.log(`   Total activities: ${totalActivities}\n`);

    const byStage = createdLeads.reduce((acc, lead) => {
      acc[lead.stage] = (acc[lead.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('   By stage:');
    for (const stage of STAGES) {
      const count = byStage[stage] || 0;
      const bar = '█'.repeat(count * 2);
      console.log(`   ${stage.padEnd(12)} ${bar} ${count}`);
    }

    console.log('\nReady for demo! Navigate to /pipeline in the UI.\n');

  } catch (error: any) {
    console.error('\nError:', error.message);
    process.exit(1);
  } finally {
    closeDriver();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
