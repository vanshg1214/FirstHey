import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrgId } from '@/lib/auth';
import { createClient } from '@/utils/supabase/server';
import { SettingsService } from '@/lib/services/settings';
import { GoogleGenAI } from '@google/genai';
import { CampaignsRepository } from '@/lib/repositories/campaigns';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth & Org ──────────────────────────────────────────────────
    const supabase = await createClient();
    const orgId = await getCurrentUserOrgId();

    if (!orgId) {
      return NextResponse.json(
        { error: 'You are not part of any organization. Please log in again.' },
        { status: 401 }
      );
    }

    // ── 2. API Key (org setting → env fallback) ─────────────────────────
    const settings = await SettingsService.getSettings(orgId);
    const geminiApiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API Key is not configured. Please add it in Organization Settings or set GEMINI_API_KEY in your environment.' },
        { status: 400 }
      );
    }

    // ── 3. Parse request body ──────────────────────────────────────────
    const body = await req.json();
    const messages: { role: string; content: string }[] = body.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided.' }, { status: 400 });
    }

    // ── 4. Fetch CRM context (non-blocking, graceful on error) ──────────
    let recentLeads: any[] = [];
    let totalLeadsCount = 0;
    let activeCampaigns: any[] = [];
    let totalCampaignsCount = 0;
    try {
      const [leadsRes, leadsCountRes, campaignsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('contact_fields, context_summary')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(100), // Reduced slightly to save tokens for campaigns
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId),
        CampaignsRepository.getCampaigns(supabase, orgId)
      ]);
      
      recentLeads = leadsRes.data || [];
      totalLeadsCount = leadsCountRes.count || recentLeads.length;
      activeCampaigns = campaignsRes || [];
      totalCampaignsCount = activeCampaigns.length;
    } catch (e) {
      console.error("Context fetch error", e);
      // CRM context is bonus — never crash the chat because of it
    }

    // ── 5. Build system instruction ────────────────────────────────────
    const companyProfile = settings.company_profile ||
      'No company profile set yet. Ask the user to fill in their Company Profile in Organization Settings so you can give better recommendations.';

    const leadsContext = recentLeads
      .map((l) => {
        const cf = l.contact_fields || {};
        const cs = l.context_summary || {};
        return `- ${cf.name || 'Unknown'} (${cf.email || 'no email'}) at ${cf.company || 'Unknown Company'}. Problem: ${cs.problem || 'N/A'}. Needs: ${cs.needs || 'N/A'}.`;
      })
      .join('\n') || 'No leads found.';

    const campaignsContext = activeCampaigns.map((c) => {
      return `### Campaign: ${c.name}
- Status: ${c.status}
- Description/Goal: ${c.description || 'None provided'}
- Performance Metrics: ${c.lead_count} total leads, ${c.emails_sent} emails sent, ${c.opened_count} opens, ${c.hot_count} hot leads.
- To improve this campaign, analyze its performance metrics against its goal. If open rates are low, suggest trying different subject lines. If hot leads are low, suggest targeting a different persona.`;
    }).join('\n\n') || 'No active campaigns found.';

    const systemInstruction = `You are an elite AI Sales Assistant embedded inside Apexora AI CRM.
Your role is to help the user manage leads, analyze their pipeline, research companies, and identify the best sales opportunities.

## What This Company Offers:
${companyProfile}

## Live CRM Data Overview:
- Total Leads in Database: ${totalLeadsCount}
- Total Campaigns in Database: ${totalCampaignsCount}

## Active Campaigns & Analytics:
${campaignsContext}

## Recent Leads Sample (up to 100):
${leadsContext}

## Your Behavior Rules:
1. When the user asks you to research a company (e.g. "Adani Mills", "Tata Steel"), USE the googleSearch tool to fetch live internet data, then cross-reference it with the company profile above to suggest how they can pitch their product.
2. When answering about CRM data, campaigns, or how to improve a campaign, aggressively use the rich analytics provided above to give specific, data-driven advice.
3. Always respond in clean, well-formatted Markdown.
4. Be concise, direct, and highly actionable — you are talking to a busy sales professional.
5. Never hallucinate. If you don't know something, say so and suggest using search.`;

    // ── 6. Build history for multi-turn chat ───────────────────────────
    // Gemini SDK chats.create() takes history (all messages except last)
    // History must alternate user/model starting with user
    const rawHistory = messages.slice(0, -1);
    const history: { role: string; parts: { text: string }[] }[] = [];

    for (const msg of rawHistory) {
      const role = msg.role === 'user' ? 'user' : 'model';
      // Skip if it would create two consecutive same-role messages
      if (history.length > 0 && history[history.length - 1].role === role) continue;
      // Skip model-only openers (Gemini requires history to start with user)
      if (history.length === 0 && role !== 'user') continue;
      history.push({ role, parts: [{ text: msg.content }] });
    }

    const lastUserMessage = messages[messages.length - 1].content;

    // ── 7. Initialise SDK & stream ──────────────────────────────────────
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const chat = ai.chats.create({
      model: 'gemini-3.6-flash',
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
      history,
    });

    const resultStream = await chat.sendMessageStream({ message: lastUserMessage });

    // ── 8. Stream response back to client ──────────────────────────────
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of resultStream) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (streamError: any) {
          console.error('[Chat] Streaming error:', streamError?.message);
          controller.error(streamError);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('[Chat API] Unhandled error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
