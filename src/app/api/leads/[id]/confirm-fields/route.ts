import { NextRequest, NextResponse } from 'next/server';
import { LeadsRepository } from '@/lib/repositories/leads';
import { FollowupDraftAgent } from '@/lib/agents/followupDraft';
import { supabaseAdmin } from '@/lib/supabase';
import { SettingsService } from '@/lib/services/settings';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { contactFields, senderName } = body;

    if (!contactFields) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required parameter: contactFields',
          },
        },
        { status: 400 }
      );
    }

    // 1. Update the contact fields in the database
    const supabase = supabaseAdmin;
    const updatedLead = await LeadsRepository.updateContactFields(supabase, id, contactFields, 'confirmed');

    // 2. Extract conversation context from database lead record
    const context = updatedLead.context_summary || {};
    const contextDetails = {
      problem: context.problem || null,
      needs: context.needs || null,
      action_items: context.action_items || [],
      notable_quotes: context.notable_quotes || [],
    };

    // 3. Fetch Exhibition Name
    let exhibitionName = updatedLead.exhibition || null;
    if (updatedLead.exhibition_id) {
      const { data: exData } = await supabaseAdmin.from('exhibitions').select('name').eq('id', updatedLead.exhibition_id).single();
      if (exData) exhibitionName = exData.name;
    }

    // 4. Fetch Settings and Generate Follow-up Draft
    const settings = await SettingsService.getSettings(updatedLead.organization_id);
    const apiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key missing in organization settings and environment variables.");
    }

    const emailDetails = {
      name: contactFields.name || null,
      company: contactFields.company || null,
      title: contactFields.title || null,
    };

    const draft = await FollowupDraftAgent.generateDraft(
      apiKey,
      emailDetails,
      contextDetails,
      senderName || 'Sales Representative',
      exhibitionName
    );

    return NextResponse.json({
      data: {
        lead: updatedLead,
        draft,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Error confirming lead fields or generating draft:', error);
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'CONFIRMATION_FAILED',
          message: error.message || 'An error occurred during fields confirmation.',
        },
      },
      { status: 500 }
    );
  }
}
