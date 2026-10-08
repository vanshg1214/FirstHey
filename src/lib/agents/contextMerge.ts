import { GoogleGenerativeAI } from '@google/generative-ai';
import { ContextExtractionOutput } from './contextExtraction';

export class ContextMergeAgent {
  /**
   * Intelligently merges two context objects (e.g., one from audio transcript, one from handwritten notes).
   * Deduplicates points and creates a unified summary.
   */
  public static async merge(contextA: any, contextB: any): Promise<ContextExtractionOutput> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is missing.');
    }

    // If one is empty, just return the other to save API calls
    const isAEmpty = !contextA || Object.keys(contextA).length === 0 || (!contextA.summary && !contextA.problem && !contextA.needs && !(contextA.action_items?.length > 0));
    const isBEmpty = !contextB || Object.keys(contextB).length === 0 || (!contextB.summary && !contextB.problem && !contextB.needs && !(contextB.action_items?.length > 0));
    
    if (isAEmpty && isBEmpty) return { problem: '', needs: '', action_items: [], sentiment: 'neutral', notable_quotes: [], transcript: '' };
    if (isAEmpty) return contextB as ContextExtractionOutput;
    if (isBEmpty) return contextA as ContextExtractionOutput;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: 'You are an expert sales assistant. Your job is to merge two sets of context (e.g., one from a voice recording and one from handwritten notes) into a single, unified, and deduplicated context object.',
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `
      Merge the following two contexts. Deduplicate any overlapping pain points, needs, or action items. 
      Retain all unique notable quotes. For sentiment, choose the most dominant or accurate sentiment representing both.
      
      Return ONLY valid JSON with these exact keys: summary (string, one combined two to three sentence summary), problem (string), needs (string), action_items (array of strings), sentiment ("positive", "neutral", "skeptical", or "critical"), and notable_quotes (array of strings).
      
      Context A:
      ${JSON.stringify(contextA, null, 2)}
      
      Context B:
      ${JSON.stringify(contextB, null, 2)}
    `;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      // Preserve existing metadata like open counts or email levels if they exist
      return {
        ...contextA,
        ...contextB,
        ...parsed,
      } as ContextExtractionOutput;
    } catch (error) {
      console.error('Error merging context:', error);
      // Fallback: simple deep merge favoring B and concatenating arrays
      return {
        ...contextA,
        ...contextB,
        summary: `${contextA.summary || ''} ${contextB.summary || ''}`.trim(),
        problem: `${contextA.problem || ''} ${contextB.problem || ''}`.trim(),
        needs: `${contextA.needs || ''} ${contextB.needs || ''}`.trim(),
        action_items: [...new Set([...(contextA.action_items || []), ...(contextB.action_items || [])])],
        notable_quotes: [...new Set([...(contextA.notable_quotes || []), ...(contextB.notable_quotes || [])])],
      };
    }
  }
}
