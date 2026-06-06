import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export interface OutreachInput {
  name: string;
  segment: string;
  strongestSignal: string;
  matchedLine: 'Hemostasis' | 'Plasma Proteins' | 'General Diagnostics';
  tier: 'HOT' | 'WARM' | 'COLD';
  matchedItemsCount: number;
}

/**
 * Task 19: AI Outreach Email Generation Service
 * Drafts conversion-optimized, peer-to-peer cold emails based on specific strategic triggers (5-Year Contracts / Upsell).
 */
export async function generateOutreachEmail(data: OutreachInput): Promise<string> {
  const systemPrompt = `
    You are an advanced B2B sales enablement AI working behind the scenes for a "Buyer Advocate" at Siemens Healthineers Marburg.
    The Buyer Advocate has a technical background, NOT a dedicated sales background. The email must sound expert-to-expert, professional, and clear. Avoid marketing hype, pushy sales jargon, or fake enthusiasm.

    Strategic Rules (From Hackathon Board Notes & Siemens Brief):
    1. Target Persona: The recipient is an R&D Lead (the leading stakeholder who initiates the purchase process for clinical assay development).
    2. Hook: Open by mentioning the target company's strongest recent signal (e.g., FDA 510(k) clearance, clinical trial phase, or patent filing) to show dedicated research.
    3. Value Prop: Emphasize Siemens Marburg's large-scale production capacities, certified quality processes, and certified biological intermediates.
    4. Strategic Routing:
       - If tier is 'HOT', focus on long-term supply stability, aligning towards a '5-year strategic contract' to safeguard their scaling pipeline.
       - If matchedItemsCount > 5, execute an 'Upsell' strategy by referencing our comprehensive portfolio of 100+ items (proteins, antibodies, latex particles, blockers).
    5. Call to Action (CTA): Propose a low-friction 5-minute technical validation call or an offer to ship a customized sample validation kit.
  `;

  const userPrompt = `
    Draft a cold outreach email for:
    - Company: ${data.name}
    - Industry Segment: ${data.segment}
    - Driving Signal: ${data.strongestSignal}
    - Siemens Product Line Match: ${data.matchedLine}
    - Urgency Level: ${data.tier}
    - Cross-sell Items Count: ${data.matchedItemsCount}
  `;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3, // Slight creativity for natural phrasing while sticking to strict guidelines
  });

  return text;
}
