import { GoogleGenerativeAI } from '@google/generative-ai';
import { ContextExtractionOutput } from './contextExtraction';

const SYSTEM =
  'You are an expert sales assistant. Your job is to read notes taken during a meeting with a lead and extract structured context. Only use what the notes say. You may paraphrase clearly, but never invent facts, numbers, names or commitments.';

const KEYS =
  'Return ONLY valid JSON with these exact keys: summary (string, two to three sentences on what was discussed and how interested the lead seemed), problem (string), needs (string, what they asked for or showed interest in), action_items (array of strings), sentiment ("positive", "neutral", "skeptical", or "critical"), and notable_quotes (array of strings). If something is not in the notes use an empty string or empty array.';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class NotesProcessingError extends Error {}

export class NotesOcrAgent {
  private static async run(apiKey: string | undefined, parts: any[]): Promise<ContextExtractionOutput> {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new NotesProcessingError('No Gemini API key is configured. Add one in Settings.');
    }

    const model = new GoogleGenerativeAI(key).getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: SYSTEM,
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    });

    const maxAttempts = 3;
    let lastError: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await model.generateContent(parts);
        const cleaned = result.response
          .text()
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        const parsed = JSON.parse(cleaned);
        return { ...parsed, transcript: '' } as ContextExtractionOutput;
      } catch (error: any) {
        lastError = error;
        console.warn(`Notes extraction attempt ${attempt} failed:`, error.message || error);
        const msg = String(error?.message || '');
        const retryable =
          error?.status === 429 ||
          error?.status === 503 ||
          /429|503|Quota exceeded|Too Many Requests|Service Unavailable/i.test(msg);
        if (retryable && attempt < maxAttempts) {
          await delay(attempt * 5000);
          continue;
        }
        break;
      }
    }
    // Surface the failure. Returning an empty result here is what made failed scans look like "no needs stated".
    throw new NotesProcessingError(`Could not read the notes: ${lastError?.message || 'unknown error'}`);
  }

  /** Reads photos of handwritten notes. */
  public static async processNotes(
    images: { base64Data: string; mimeType: string }[],
    apiKey?: string
  ): Promise<ContextExtractionOutput> {
    const imageParts = images.map(img => ({ inlineData: { data: img.base64Data, mimeType: img.mimeType } }));
    return this.run(apiKey, [
      `Read the handwritten notes in the provided image(s) and extract the context. Combine information if there are multiple images. ${KEYS}`,
      ...imageParts,
    ]);
  }

  /** Reads notes the rep typed in. */
  public static async processText(text: string, apiKey?: string): Promise<ContextExtractionOutput> {
    return this.run(apiKey, [
      `These are notes typed by a sales rep after meeting a lead at an exhibition. Extract the context.\n\nNotes:\n"""\n${text}\n"""\n\n${KEYS}`,
    ]);
  }
}
