import { createDriver, runQuery } from '../services/graph/neo4j.js';
import { closeDriver } from '../services/graph/neo4j.js';

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

await createDriver({ uri: NEO4J_URI, user: NEO4J_USER, password: NEO4J_PASSWORD });

const scoredCompanies = [
  { name: 'Bio-Rad Laboratories', contacts: [
    { name: 'Dr. Maria Santos', email: 'm.santos@bio-rad.com', role: 'Director of Procurement' },
    { name: 'James Chen', email: 'j.chen@bio-rad.com', role: 'R&D Manager' },
  ]},
  { name: 'Roche Diagnostics', contacts: [
    { name: 'Dr. Hans Mueller', email: 'h.mueller@roche.com', role: 'VP Product Development' },
    { name: 'Sarah Johnson', email: 's.johnson@roche.com', role: 'Procurement Specialist' },
  ]},
  { name: 'Phadia GmbH', contacts: [
    { name: 'Dr. Klaus Schmidt', email: 'k.schmidt@phadia.com', role: 'Technical Director' },
  ]},
  { name: 'Euroimmun AG', contacts: [
    { name: 'Dr. Anna Weber', email: 'a.weber@euroimmun.de', role: 'Chief Scientific Officer' },
    { name: 'Peter Frank', email: 'p.frank@euroimmun.de', role: 'Supply Chain Manager' },
  ]},
  { name: 'Randox Laboratories Limited', contacts: [
    { name: 'Dr. Emily Brown', email: 'e.brown@randox.com', role: 'R&D Director' },
  ]},
  { name: 'Hycor Biomedical', contacts: [
    { name: 'Dr. David Lee', email: 'd.lee@hycor.com', role: 'VP Manufacturing' },
  ]},
  { name: 'Dynatech Laboratories', contacts: [
    { name: 'Laura Martinez', email: 'l.martinez@dynatech.com', role: 'Quality Assurance Manager' },
  ]},
  { name: 'Mikrogen GmbH', contacts: [
    { name: 'Dr. Stefan Hoffmann', email: 's.hoffmann@mikrogen.de', role: 'Director of Diagnostics' },
  ]},
  { name: 'Bio-Tek Instruments', contacts: [
    { name: 'Robert Taylor', email: 'r.taylor@biotek.com', role: 'Product Manager' },
  ]},
  { name: 'Aesku.Diagnostics GmbH', contacts: [
    { name: 'Dr. Julia Wagner', email: 'j.wagner@aesku.com', role: 'Head of Development' },
  ]},
];

for (const company of scoredCompanies) {
  console.log(`Adding contacts for ${company.name}...`);

  const result = await runQuery(
    `MATCH (c:Company {name: $name})
     RETURN c.id AS id`,
    { name: company.name }
  );

  if (result.records?.length === 0) {
    console.log(`  Company not found: ${company.name}`);
    continue;
  }

  for (const contact of company.contacts) {
    await runQuery(
      `MATCH (c:Company {name: $companyName})
       MERGE (contact:Contact {email: $email})
       ON CREATE SET
         contact.id = randomUUID(),
         contact.name = $name,
         contact.role = $role
       MERGE (contact)-[:CONTACT_AT]->(c)`,
      {
        companyName: company.name,
        email: contact.email,
        name: contact.name,
        role: contact.role,
      }
    );
    console.log(`  Added: ${contact.name} (${contact.email})`);
  }
}

console.log('\nDone!');

await closeDriver();
