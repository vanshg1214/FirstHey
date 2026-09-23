import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { CONTEXT_EXTRACTION_SYSTEM_PROMPT } from '@/lib/prompts/contextExtraction.prompt';

// Define the extraction output schema, now including the transcript
export const ContextExtractionOutputSchema = z.object({
  transcript: z.string().describe('The verbatim transcription of the provided audio'),
  problem: z.string().nullable().describe('The core problem or pain point the buyer is facing'),
  needs: z.string().nullable().describe('The specific services, products, or features they need'),
  action_items: z.array(z.string()).describe('A list of explicit promises or follow-up tasks agreed upon'),
  notable_quotes: z.array(z.string()).describe('Direct, verbatim statements of significance from the buyer'),
  sentiment: z.enum(['positive', 'neutral', 'skeptical', 'critical']).describe("The buyer's overall tone and attitude"),
});

export type ContextExtractionOutput = z.infer<typeof ContextExtractionOutputSchema>;

export class ContextExtractionAgent {
  /**
   * Transcribes audio and extracts structured sales context in one multimodal pass.
   * Employs Gemini 1.5 Flash for high-speed, cost-effective processing.
   */
  public static async extractContext(apiKey: string, audioBase64: string, mimeType: string): Promise<ContextExtractionOutput> {
    if (!apiKey) {
      throw new Error('Gemini API key is required but was not provided.');
    }

    if (!audioBase64) {
      throw new Error('Audio payload is empty.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: CONTEXT_EXTRACTION_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      }
    });

    const audioPart = {
      inlineData: {
        data: audioBase64,
        mimeType: mimeType
      }
    };

    const prompt = 'Listen to the following audio recording. First, provide a complete verbatim transcript. Second, extract the structured details according to the JSON schema format required. Keys must exactly match: transcript, problem, needs, action_items, notable_quotes, sentiment.';

    try {
      const result = await model.generateContent([prompt, audioPart]);
      const text = result.response.text();
      
      // Strip markdown code blocks if Gemini returned them
      const cleanText = text.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim();
      
      const parsed = JSON.parse(cleanText);
      return parsed as ContextExtractionOutput;
    } catch (error) {
      console.error('Error in Context Extraction Agent (Gemini):', error);
      throw new Error(`Failed to extract context from audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
