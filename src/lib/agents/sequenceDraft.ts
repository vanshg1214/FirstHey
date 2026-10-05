import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';
import { SEQUENCE_NEXT_SYSTEM_PROMPT } from '@/lib/prompts/sequenceNext.prompt';

export interface SequenceDraftInput {
  contact: { name?: string | null; company?: string | null; title?: string | null };
  context: { problem?: string | null; needs?: string | null; action_items?: string[]; notable_quotes?: string[] };
  exhibition?: string | null;
  companyProfile?: string | null;
  previousEmails: { position: number; subject: string | null; body: string | null; sent_at: string | null }[];
  engagement: { opened: boolean; openCount: number; lastOpenedAt: string | null };
  touchNumber: number;
  totalTouches: number;
  senderName: string;
}

export interface SequenceDraftOutput {
  subject: string;
  emailBody: string;
}

export class SequenceDraftAgent {
  /**
   * Writes the next email in the drip. Unlike the Touch 1 agent this throws on failure
   * instead of returning generic filler, so the caller can retry later rather than
   * sending a low-quality email to a real prospect.
   */
  public static async generateNext(apiKey: string, input: SequenceDraftInput): Promise<SequenceDraftOutput> {
    if (!apiKey) {
      throw new Error('Gemini API key is required but was not provided.');
    }

    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        subject: { type: SchemaType.STRING, description: 'Short, specific subject line, under 7 words' },
        emailBody: { type: SchemaType.STRING, description: 'Email body without sign-off or signature' },
      },
      required: ['subject', 'emailBody'],
    };

    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: SEQUENCE_NEXT_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.8,
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    const payload = JSON.stringify(
      {
        contact: input.contact,
        conversation_context: input.context,
        exhibition: input.exhibition || 'Unknown Event',
        company_profile: input.companyProfile || null,
        previous_emails: input.previousEmails,
        engagement: input.engagement,
        touch_number: input.touchNumber,
        total_touches: input.totalTouches,
        is_final_touch: input.touchNumber >= input.totalTouches,
        sender_name: input.senderName,
      },
      null,
      2
    );

    const result = await model.generateContent(`Write the next email for this lead:\n\n${payload}`);
    const parsed = JSON.parse(result.response.text()) as SequenceDraftOutput;

    if (!parsed.subject?.trim() || !parsed.emailBody?.trim()) {
      throw new Error('AI returned an empty subject or body.');
    }

    // Enforce the no-em-dash rule even if the model slips.
    const clean = (s: string) => s.replace(/\s*—\s*/g, ', ').trim();
    return { subject: clean(parsed.subject), emailBody: clean(parsed.emailBody) };
  }
}
