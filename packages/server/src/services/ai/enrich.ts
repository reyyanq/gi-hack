import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export interface EnrichedCompany {
  segment: 'IVD' | 'CDMO' | 'Biotech Startup' | 'Pharmaceutical' | 'Laboratory Equipment Supplier';
  domain: string;
  applications: string[];
  description: string;
}

/**
 * Task 18: AI Enrichment Service
 * Analyzes raw market signals fetched by the ingestion pipeline and structures them into a business profile.
 */
export async function enrichCompanyData(companyName: string, signalsText: string): Promise<EnrichedCompany> {
  const systemPrompt = `
    You are an expert B2B BioTech Sales Intelligence Agent for Siemens Healthineers Marburg.
    Your job is to analyze a target company based on its public market signals and categorize its diagnostic operations.
    
    Strictly classify the company segment into one of these: 'IVD', 'CDMO', 'Biotech Startup', 'Pharmaceutical', or 'Laboratory Equipment Supplier'.
    Identify the focus domain and specific diagnostic applications (e.g., Hemostasis, Plasma Proteins, Immunoassays).
    
    You must respond strictly with a valid JSON object matching the schema below. 
    Do NOT wrap the response in markdown code blocks like \`\`\`json. Do not include any extra text.
    
    Schema:
    {
      "segment": "IVD",
      "domain": "Coagulation and Hemostasis testing",
      "applications": ["Factor VII Assay", "Clinical Diagnostics"],
      "description": "A molecular diagnostics company specialized in blood coagulation kits."
    }
  `;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: `Company Name: ${companyName}\nSignals and Raw Text: ${signalsText}`,
    temperature: 0.1, // Low temperature for highly structured and consistent JSON outputs
  });

  return JSON.parse(text.trim()) as EnrichedCompany;
}
