# Agentic Outreach Workflow

**Date:** 2026-06-06
**Branch:** feature/pipeline-mvp
**Feature:** Automated lead qualification with consent management

---

## Workflow Overview

**Goal:** Automate the initial lead qualification process while ensuring GDPR compliance through explicit consent.

**Flow:**
```
HOT/WARM Lead Selection
    ↓
Scrape Company Data
    ↓
Generate Personalized Outreach Email (AI)
    ↓
Send Preference Confirmation Form
    ↓
Customer Response → Consent Confirmation
    ↓
Add to Pipeline (Contacted Stage)
```

---

## Components

### 1. Lead Qualifier Agent

**File:** `packages/server/src/services/agents/leadQualifier.ts`

**Responsibility:** Selects companies from graph that qualify for outreach.

**Selection Criteria:**
- Tier: HOT or WARM
- No existing Contact node in pipeline
- HAS_SIGNAL relationships present
- No previous outreach within 30 days (tracked via OUTREACH_SENT label)

**Query:**
```cypher
MATCH (c:Company)
WHERE c.tier IN ['HOT', 'WARM']
AND NOT (c)<-[:CONTACT_AT]-(:Contact)
AND (c)-[:HAS_SIGNAL]->(:Signal)
AND NOT (c)-[:OUTREACH_SENT]->(:Outreach)
WITH c
OPTIONAL MATCH (c)-[:OUTREACH_SENT]->(o:Outreach)
WHERE o.date > datetime() - duration('P30D')
WITH c, count(o) AS recentOutreach
WHERE recentOutreach = 0
RETURN c
ORDER BY c.totalScore DESC
LIMIT 5
```

**Returns:** Top 5 qualified companies per batch.

### 2. Company Profile Builder

**File:** `packages/server/src/services/agents/companyProfiler.ts`

**Responsibility:** Extracts comprehensive company profile for AI outreach generation.

**Data Collected:**
- Company name, domain, segment, tier, totalScore, signalScore, productFit
- All HAS_SIGNAL relationships (type, description, date, confidence, url)
- All DEVELOPS relationships (application name, category)
- Top 3 strongest signals by confidence × recency

**Output:**
```typescript
interface CompanyProfile {
  name: string;
  domain: string;
  segment: string;
  tier: 'HOT' | 'WARM' | 'COLD';
  totalScore: number;
  signalScore: number;
  productFit: number;
  signals: Array<{
    type: string;
    description: string;
    date: string;
    confidence: number;
    url: string;
  }>;
  applications: Array<{
    name: string;
    category: string;
  }>;
  strongestSignal: string;
  matchedProductLine: 'Hemostasis' | 'Plasma Proteins' | 'General Diagnostics';
}
```

### 3. Outreach Email Generator

**File:** `packages/server/src/services/agents/outreachGenerator.ts`

**Responsibility:** Generates personalized outreach emails using LLM.

**Enhanced Prompt:**
```
You are generating a personalized outreach email for Siemens Healthineers Marburg.

Company context provided: signals, tier, score breakdown, applications.

Requirements:
1. Opening: Reference their strongest/most recent signal (shows research)
2. Interest validation: Explain why this company is a good fit (product/portfolio match)
3. Value proposition: Brief mention of our production capacity, quality certification
4. Clear CTA: Link to preference confirmation form (short, low-friction)
5. GDPR: Explicit consent language in CTA

Tone: Professional, expert-to-expert, not salesy. Avoid marketing hype.

Email structure:
- Subject line (personalized)
- Salutation (use contact name if available, otherwise "Dear [Team]")
- 2-3 paragraphs max
- CTA button text: "Confirm Preferences"
- Privacy note: "By clicking, you agree to receive follow-up communications"

Generate email in English.
```

**Output:**
```typescript
interface GeneratedEmail {
  subject: string;
  body: string;
  ctaUrl: string;
  previewText: string;
}
```

### 4. Preference Confirmation Service

**File:** `packages/server/src/services/agents/preferenceConfirmation.ts`

**Responsibility:** Manages customer data confirmation page and consent tracking.

**Customer Confirmation Page:** `/preferences/:contactId/:token`

**What the customer sees:**
- Pre-filled company name (from scraped data)
- Pre-fetched interest areas (from AI analysis of their signals)
- Customer confirms/corrects their contact information
- Customer selects communication preferences
- Customer reviews and confirms areas of interest
- Explicit consent checkbox (GDPR required)

**Form Fields:**
```typescript
interface PreferenceForm {
  contactId: string;
  companyName: string;
  contactName: string;
  email: string;
  role: string;
  consentGiven: boolean;
  preferredContactMethod: 'email' | 'call' | 'both';
  interestLevel: 'high' | 'medium' | 'scheduling_only';
  areasOfInterest: string[];
  timeline: 'immediate' | '1-3_months' | 'exploring';
  additionalNotes?: string;
}
```

**Token:** Expiring signed token (via JWT) valid for 7 days.

**On Submission:**
1. Validate token signature + expiration
2. Update Contact node with customer-confirmed data:
   ```cypher
   MATCH (c:Contact {id: $contactId})
   SET c.name = $contactName,
       c.email = $email,
       c.role = $role,
       c.consentGiven = true,
       c.consentDate = toString(datetime()),
       c.preferredContactMethod = $method,
       c.interestLevel = $interest,
       c.interestedAreas = $areas,
       c.timeline = $timeline
   ```
3. Verify email format and domain matches company
4. If `interestLevel !== 'exploring'`, advance to "Contacted" stage
5. Add activity: "PREFERENCE_CONFIRMED" with form data
6. Send confirmation email to customer (acknowledging consent)

### 5. Outreach Orchestrator

**File:** `packages/server/src/services/agents/outreachOrchestrator.ts`

**Responsibility:** Coordinates the full workflow execution.

**Execution Flow:**
```typescript
async function runOutreachBatch() {
  const qualifiedCompanies = await leadQualifier.findQualifiedLeads();

  for (const company of qualifiedCompanies) {
    const profile = await companyProfiler.buildProfile(company.id);

    if (!profile.signals || profile.signals.length === 0) {
      continue;
    }

    const email = await outreachGenerator.generateEmail(profile);

    const contact = await createPlaceholderContact(profile);

    const consentToken = await generateConsentToken(contact.id);

    const formUrl = `${origin}/preferences/${contact.id}/${consentToken}`;

    await outreachEmailService.send(email.to, email.subject, email.body, {
      ctaUrl: formUrl,
      trackingPixel: `/track/open/${contact.id}/${consentToken}`
    });

    await markOutreachSent(company.id, contact.id, formUrl);
  }

  return { sent: qualifiedCompanies.length };
}
```

**Scheduling:** Runs daily at 09:00 CET via cron job.

---

## API Endpoints

### Outreach Management

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/agents/outreach/run` | Manually trigger outreach batch (admin only) |
| GET | `/api/agents/outreach/schedule` | Get next scheduled run time |
| GET | `/api/agents/outreach/stats` | Outreach metrics (sent, opened, responded, consented) |

### Preference Form

| Method | Path | Description |
|--------|------|-------------|
| GET | `/preferences/:contactId/:token` | Render customer data confirmation page |
| POST | `/preferences/:contactId/:token` | Submit confirmed preferences and consent |
| POST | `/api/agents/preferences/validate` | Validate token and fetch pre-filled data |
| GET | `/api/agents/preferences/:contactId` | Get contact preferences (admin) |

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/email/opened` | Email opened (tracking pixel) |
| POST | `/webhooks/email/clicked` | CTA link clicked |
| POST | `/webhooks/email/bounced` | Email bounced |

---

## Frontend

### Preference Form Page

**Route:** `/preferences/[contactId]/[token]`

**Design:**
- Clean, minimal landing page
- Company header with scraped info
- Pre-filled contact data (editable by customer)
- Progress indicator (step 1 of 1)
- Consent checkbox (required, GDPR - cannot be pre-checked)
- Multi-select interest areas (pre-populated from AI analysis)
- Submit button: "Confirm My Details & Preferences"
- Thank you message with expected follow-up timeline

**What the customer does:**
1. Verify their company name (scraped from public data)
2. Confirm/correct their contact details (name, email, role)
3. Select preferred communication method
4. Review AI-suggested interest areas (can add/remove)
5. Select their interest level and timeline
6. Check explicit consent checkbox
7. Submit

**Validation:**
- Token must be valid and not expired
- Consent checkbox must be checked
- Contact method must be selected
- Email format must be valid
- Email domain should match company domain (soft validation)

---

## Database Schema Changes

### New Labels

- `(:Outreach)` - Tracks outreach attempts
  ```properties
  id: string
  date: string
  emailSubject: string
  formUrl: string
  token: string
  ```

### Contact Node Properties (Added)

```cypher
:Contact
├─ consentGiven: boolean
├─ consentDate: string
├─ preferredContactMethod: 'email' | 'call' | 'both'
├─ interestLevel: 'high' | 'medium' | 'scheduling_only'
├─ interestedAreas: string[]
├─ timeline: 'immediate' | '1-3_months' | 'exploring'
```

### New Relationships

```cypher
(:Company)-[:OUTREACH_SENT]->(:Outreach)
(:Outreach)-[:SENT_TO]->(:Contact)
```

---

## Email Service Integration

### Providers (Priority Order)

1. **Resend** (primary) - Fast, good deliverability, modern API
2. **SendGrid** (fallback) - Reliable, widely used
3. **AWS SES** (fallback) - Cost-effective for high volume

**Configuration:**
```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxx
FROM_EMAIL=tobias.weiss@siemens-healthineers.com
FROM_NAME="Tobias Weiss | Siemens Healthineers"
```

**Tracking:**
- Open tracking via transparent pixel
- Click tracking via redirect URL
- Bounce webhook callback

---

## MVP Demo Mock

For the hackathon demo, we'll simulate the agentic workflow:

1. **Mock Outreach Generator:** Pre-generate 2-3 realistically personalized emails
2. **Preference Confirmation Page:** Already implemented at `/preferences/[contactId]/[token]`
3. **Demo Data:** Demo pipeline loaded with `npm run demo:pipeline`
4. **Demo Flow:**
   - Show HOT leads dashboard (filter by tier)
   - Click "Generate Outreach Email" on a HOT lead
   - Show AI-generated personalized email with portfolio match details
   - Display "Copy Link" button for preference confirmation page
   - Navigate to preference form URL (open in new tab)
   - Show customer confirming their details and providing consent
   - Lead advances to "Contacted" pipeline stage automatically
   - Display consent confirmation activity in timeline

**Sample Demo URLs:**
- Dashboard: `http://localhost:5173/`
- Pipeline: `http://localhost:5173/pipeline`
- Preference Form (demo token): `http://localhost:5173/preferences/[id]/demo_token_123`

---

## Success Metrics

- **Response Rate:** % of recipients who click preference form link (target: >25%)
- **Consent Rate:** % who submit form with consent (target: >80% of clickers)
- **Pipeline Conversion:** % who advance beyond "Contacted" (target: >50%)
- **Time to Consent:** Average time from send to consent (target: <48h)

---

## GDPR Compliance Checklist

- ✅ Explicit consent obtained before follow-up
- ✅ Consent checkbox cannot be pre-checked
- ✅ Clear explanation of what consent means
- ✅ Easy opt-out link in all emails
- ✅ Consent stored with timestamp
- ✅ Data retention policy documented
- ✅ Right to delete honored (delete Contact node)
