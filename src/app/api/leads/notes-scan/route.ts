import { NextRequest, NextResponse } from 'next/server';
import { NotesOcrAgent } from '@/lib/agents/notesOcr';
import { ContextMergeAgent } from '@/lib/agents/contextMerge';
import { supabaseAdmin } from '@/lib/supabase';
import { LeadsRepository } from '@/lib/repositories/leads';
import { getCurrentUserOrgId } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { images, leadId } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required parameter: images (array of base64 strings)',
          },
        },
        { status: 400 }
      );
    }

    // Parse data URIs for all images
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

    // Process all images with Gemini Vision
    const extractedContext = await NotesOcrAgent.processNotes(parsedImages);
    let finalContext = extractedContext;

    // If leadId is provided, merge with existing context and save to DB (scoped to this org)
    if (leadId) {
      try {
        const orgId = await getCurrentUserOrgId();
        if (!orgId) {
          return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
        }

        const { data: lead } = await supabaseAdmin
          .from('leads')
          .select('context_summary')
          .eq('id', leadId)
          .eq('organization_id', orgId)
          .single();

        if (lead && lead.context_summary) {
          // Merge existing context (e.g. from voice) with new notes context
          finalContext = await ContextMergeAgent.merge(lead.context_summary, extractedContext);
        }

        // Save unified context back to the DB
        await supabaseAdmin
          .from('leads')
          .update({ context_summary: finalContext })
          .eq('id', leadId)
          .eq('organization_id', orgId);
      } catch (dbError) {
        console.error('Error fetching/merging lead context:', dbError);
        // Fallback to just the extracted notes context if DB operation fails
      }
    }

    return NextResponse.json({
      data: finalContext,
      error: null,
    });
  } catch (error: any) {
    console.error('Error in Notes Scan API route:', error);
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'OCR_PROCESSING_FAILED',
          message: error.message || 'An error occurred during notes OCR processing.',
        },
      },
      { status: 500 }
    );
  }
}
