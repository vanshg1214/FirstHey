import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { ContextExtractionOutput } from './contextExtraction';

export class NotesOcrAgent {
  /**
   * Processes an array of base64 images of handwritten notes and returns structured context fields.
   * Uses Google Generative AI SDK directly for native multi-image support.
   */
  public static async processNotes(images: { base64Data: string; mimeType: string }[]): Promise<ContextExtractionOutput> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key (GEMINI_API_KEY) is missing in environment variables.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: 'You are an expert sales assistant. Your job is to read handwritten notes taken during a meeting with a lead and extract structured context. Extract the lead\'s pain points, needs, action items, overall sentiment, and any direct quotes if noted.',
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const imageParts = images.map(img => ({
      inlineData: {
        data: img.base64Data,
        mimeType: img.mimeType,
      },
    }));

    const prompt = `Read the handwritten notes in the provided image(s) and extract the context. Combine information if there are multiple images. Return ONLY valid JSON with these exact keys: problem (string), needs (string), action_items (array of strings), sentiment ("positive", "neutral", "skeptical", or "critical"), and notable_quotes (array of strings). Do not invent information; if it's not present, use empty strings or empty arrays.`;

    let attempts = 0;
    const maxAttempts = 3;
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    while (attempts < maxAttempts) {
      try {
        const result = await model.generateContent([prompt, ...imageParts]);
        const text = result.response.text();
        // Strip markdown code fences if present
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          ...parsed,
          transcript: '',
        } as ContextExtractionOutput;
      } catch (error: any) {
        attempts++;
        console.warn(`Notes OCR attempt ${attempts} failed:`, error.message || error);
        
        const isRetryable = error.status === 429 || error.status === 503 || 
                           (error.message && (error.message.includes('429') || error.message.includes('503') || error.message.includes('Quota exceeded') || error.message.includes('Too Many Requests') || error.message.includes('Service Unavailable')));
                           
        if (isRetryable && attempts < maxAttempts) {
          const waitTime = attempts * 5000;
          console.log(`Rate limited/Unavailable. Waiting ${waitTime/1000}s before retrying...`);
          await delay(waitTime);
          continue;
        }

        console.error('Final error in Notes OCR Agent (Gemini):', error);
        return {
          problem: '',
          needs: '',
          action_items: [],
          sentiment: 'neutral',
          notable_quotes: [],
          transcript: '',
        };
      }
    }

    return {
      problem: '',
      needs: '',
      action_items: [],
      sentiment: 'neutral',
      notable_quotes: [],
      transcript: '',
    };
  }
}
// Force Next.js Turbopack cache invalidation
