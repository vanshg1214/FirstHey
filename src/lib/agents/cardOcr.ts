import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { CARD_OCR_SYSTEM_PROMPT } from '@/lib/prompts/cardOcr.prompt';

// Define the precise schema for the expected OCR output
export const CardOcrOutputSchema = z.object({
  name: z.string().nullable().describe('The full name of the person'),
  company: z.string().nullable().describe('The organization or company name'),
  title: z.string().nullable().describe('The job title or designation'),
  email: z.string().email().nullable().describe('The email address'),
  phone: z.string().nullable().describe('The primary contact phone number'),
  secondary_phone: z.string().nullable().describe('The secondary contact phone number or mobile, if present'),
  website: z.string().nullable().describe('The website URL'),
  confidence_score: z.number().min(0).max(100).describe('Estimated confidence in extraction accuracy (0-100)'),
});

export type CardOcrOutput = z.infer<typeof CardOcrOutputSchema>;

export class CardOcrAgent {
  /**
   * Processes a base64 business card image and returns structured contact fields.
   * Uses Google Generative AI SDK directly for native image support.
   */
  public static async processCard(apiKey: string, imageBase64: string, mimeType: string): Promise<CardOcrOutput> {
    if (!apiKey) {
      throw new Error('Gemini API key is required but was not provided.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: CARD_OCR_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    };

    const prompt = `Extract the contact details from this business card image and return ONLY valid JSON with these exact keys: name, company, title, email, phone, secondary_phone, website, confidence_score. Use null for any field that is not visible on the card. If there are multiple phone numbers, put the primary one in 'phone' and the second one in 'secondary_phone'. IMPORTANT: For all phone numbers, if no country code is printed on the card, you MUST prepend '+91 '. If one is printed, use it. confidence_score should be a number from 0 to 100.`;

    let attempts = 0;
    const maxAttempts = 3;
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    while (attempts < maxAttempts) {
      try {
        const result = await model.generateContent([prompt, imagePart]);
        const text = result.response.text();
        // Strip markdown code fences if present
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return parsed as CardOcrOutput;
      } catch (error: any) {
        attempts++;
        console.warn(`OCR attempt ${attempts} failed:`, error.message || error);
        
        const isRateLimit = error.status === 429 || error.status === 503 ||
                           (error.message && (error.message.includes('429') || error.message.includes('503') || error.message.includes('Quota exceeded') || error.message.includes('Too Many Requests') || error.message.includes('Service Unavailable')));
                           
        if (isRateLimit && attempts < maxAttempts) {
          const waitTime = 20000; // Wait 20 seconds to clear the 19s lock
          console.log(`Rate limited by Gemini. Waiting ${waitTime/1000}s before retrying...`);
          await delay(waitTime);
          continue;
        }

        console.error('Final error in Card OCR Agent (Gemini):', error);
        throw new Error(`Failed to extract contact from business card: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Fallback if loop exits (should not happen, but for TS completeness)
    throw new Error('Failed to extract contact from business card: max retries exceeded');
  }
}
