import { GoogleGenerativeAI } from '@google/generative-ai';

export class CompanyResearchAgent {
  /**
   * Researches a company to provide context for personalized sales emails.
   */
  public static async research(
    apiKey: string,
    companyName: string
  ): Promise<string | null> {
    if (!apiKey) {
      console.warn('[CompanyResearchAgent] No API key provided');
      return null;
    }

    if (!companyName || companyName.trim().length < 2) {
      return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Using 1.5-flash for fast knowledge retrieval (fallback to 3.6-flash if needed)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: `You are a B2B sales intelligence agent. Your job is to provide a brief 2-3 sentence summary of what a company does, their industry, and their primary business model based on their name. Keep it extremely concise. This will be used to contextualize a sales email. If you do not know the company, just say "Unknown company." Do not invent facts.`
    });

    try {
      const prompt = `Company Name: ${companyName}`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      if (text.includes("Unknown company")) {
        return null;
      }
      
      return text.trim();
    } catch (error) {
      console.error('[CompanyResearchAgent] Research failed:', error);
      return null;
    }
  }
}
