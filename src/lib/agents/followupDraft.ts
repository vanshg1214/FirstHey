import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';
import { FOLLOWUP_DRAFT_SYSTEM_PROMPT } from '@/lib/prompts/followupDraft.prompt';

export interface FollowupDraftOutput {
  subject: string;
  emailBody: string;
  whatsappBody: string;
}

export class FollowupDraftAgent {
  /**
   * Generates a highly personalized Touch 1 email based on extracted context.
   */
  public static async generateDraft(
    apiKey: string,
    contactFields: { name?: string | null; company?: string | null; title?: string | null },
    contextSummary: { problem?: string | null; needs?: string | null; action_items?: string[]; notable_quotes?: string[] },
    senderName: string = 'Sales Rep'
  ): Promise<FollowupDraftOutput> {
    if (!apiKey) {
      throw new Error('Gemini API key is required but was not provided.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        subject: {
          type: SchemaType.STRING,
          description: "The email subject line, catchy and personalized",
        },
        emailBody: {
          type: SchemaType.STRING,
          description: "The full email body text, formatted with appropriate line breaks",
        },
        whatsappBody: {
          type: SchemaType.STRING,
          description: "The text for a WhatsApp message, short and casual",
        },
      },
      required: ["subject", "emailBody", "whatsappBody"],
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: FOLLOWUP_DRAFT_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const payload = JSON.stringify({
      contact: contactFields,
      context: contextSummary,
      sender_name: senderName,
    }, null, 2);

    const prompt = `Generate the follow-up draft for the following lead:\n\n${payload}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text) as FollowupDraftOutput;
    } catch (error) {
      console.error('[FollowupDraftAgent] CRITICAL: AI generation failed. Full error:', JSON.stringify(error, null, 2));
      return {
        subject: 'Great meeting you!',
        emailBody: `Dear ${contactFields.name ? contactFields.name : 'Sir/Ma\'am'},\n\nIt was great meeting you recently. I'd love to stay in touch and explore how we can collaborate. Let me know when you have some time for a quick chat.`,
        whatsappBody: `Hi ${contactFields.name ? contactFields.name : 'there'}! It was great meeting you recently. Let's stay in touch!`
      };
    }
  }
}
