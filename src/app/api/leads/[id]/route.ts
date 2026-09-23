import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // PostgreSQL ON DELETE CASCADE will automatically clean up associated recordings, 
    // card scans, followups, and crm sync logs.
    const { error } = await supabaseAdmin
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Database error deleting lead: ${error.message}`);
    }

    return NextResponse.json({
      data: { success: true },
      error: null,
    });
  } catch (error: any) {
    console.error('Error deleting lead:', error);
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'DELETE_FAILED',
          message: error.message || 'An error occurred during deletion.',
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Allow patching safe fields: notes, status, etc.
    const allowedFields: Record<string, any> = {};
    if (body.notes !== undefined) allowedFields.notes = body.notes;
    if (body.status !== undefined) allowedFields.status = body.status;
    if (body.context_summary !== undefined) allowedFields.context_summary = body.context_summary;
    if (body.exhibition_id !== undefined) allowedFields.exhibition_id = body.exhibition_id;
    if (body.exhibition !== undefined) allowedFields.exhibition = body.exhibition;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ data: null, error: { code: 'NO_FIELDS', message: 'No valid fields provided to update.' } }, { status: 400 });
    }



    const { error } = await supabaseAdmin
      .from('leads')
      .update(allowedFields)
      .eq('id', id);

    if (error) {
      throw new Error(`Database error updating lead: ${error.message}`);
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    console.error('Error patching lead:', error);
    return NextResponse.json(
      { data: null, error: { code: 'PATCH_FAILED', message: error.message || 'An error occurred.' } },
      { status: 500 }
    );
  }
}

