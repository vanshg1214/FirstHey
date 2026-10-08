import { NextRequest, NextResponse } from 'next/server';
import { NotesOcrAgent } from '@/lib/agents/notesOcr';
import { ContextMergeAgent } from '@/lib/agents/contextMerge';
import { SettingsService } from '@/lib/services/settings';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUserOrgId } from '@/lib/auth';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await req.json();
    const { images, text, leadId } = body;
    const typedText = typeof text === 'string' ? text.trim() : '';
    const hasImages = Array.isArray(images) && images.length > 0;

    if (!hasImages && !typedText) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Provide photos of your notes (images) or typed notes (text).' } },
        { status: 400 }
      );
    }

    // If a lead is given, it must belong to this organization.
    let existingContext: any = null;
    if (leadId) {
      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('context_summary')
        .eq('id', leadId)
        .eq('organization_id', orgId)
        .single();
      if (!lead) {
        return NextResponse.json({ data: null, error: { code: 'NOT_FOUND', message: 'Lead not found' } }, { status: 404 });
      }
      existingContext = lead.context_summary || {};
    }

    const settings = await SettingsService.getSettings(orgId);
    const apiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY;

    let extracted;
    if (hasImages) {
      const parsedImages = images.map((image: string) => {
        let mimeType = 'image/jpeg';
        let base64Data = image;
        const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
        return { base64Data, mimeType };
      });
      extracted = await NotesOcrAgent.processNotes(parsedImages, apiKey);
    } else {
      extracted = await NotesOcrAgent.processText(typedText.slice(0, 8000), apiKey);
    }

    let finalContext: any = extracted;

    if (leadId) {
      // Combine with anything already captured (for example from the voice recording).
      const { latest_draft, ...previous } = existingContext || {};
      const merged = await ContextMergeAgent.merge(previous, extracted);
      finalContext = merged;

      const { error: saveError } = await supabaseAdmin
        .from('leads')
        .update({ context_summary: { ...(existingContext || {}), ...merged } })
        .eq('id', leadId)
        .eq('organization_id', orgId);
      if (saveError) {
        console.error('Could not save notes context:', saveError.message);
        return NextResponse.json(
          { data: null, error: { code: 'SAVE_FAILED', message: `Notes were read but could not be saved: ${saveError.message}` } },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ data: finalContext, error: null });
  } catch (error: any) {
    console.error('Error in Notes Scan API route:', error);
    return NextResponse.json(
      { data: null, error: { code: 'OCR_PROCESSING_FAILED', message: error.message || 'An error occurred while reading the notes.' } },
      { status: 500 }
    );
  }
}
