import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Task 20: AI Score Explainer Service
 * Translates abstract mathematical scoring outputs into clear, qualitative justifications for non-sales personnel.
 */
export async function generateScoreExplanation(companyName: string, scoreBreakdown: any): Promise<string> {
  const systemPrompt = `
    You are an AI Sales Intelligence Explainer. Your task is to interpret a complex numerical lead score breakdown 
    and turn it into plain, actionable insights for a Siemens production scientist (Buyer Advocate).
    
    Explain exactly WHY this company scored high and why it represents a concrete business opportunity.
    Use bullet points and clear emojis. Maximum 3 bullet points. Be concise.
  `;

  const userPrompt = `
    Explain the score for company "${companyName}".
    Numerical Breakdown Data: ${JSON.stringify(scoreBreakdown)}
  `;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.2,
  });

  return text;
}
