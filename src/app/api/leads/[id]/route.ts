import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

async function getAuth(): Promise<{ userId: string; orgId: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
  if (!userData?.organization_id) return null;
  return { userId: user.id, orgId: userData.organization_id };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    // Scoped to org - prevents deleting another user's lead
    const { error } = await supabaseAdmin
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('organization_id', auth.orgId);

    if (error) {
      throw new Error(`Database error deleting lead: ${error.message}`);
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    console.error('Error deleting lead:', error);
    return NextResponse.json(
      { data: null, error: { code: 'DELETE_FAILED', message: error.message || 'An error occurred during deletion.' } },
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
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await req.json();

    const allowedFields: Record<string, any> = {};
    if (body.notes !== undefined) allowedFields.notes = body.notes;
    if (body.status !== undefined) allowedFields.status = body.status;
    if (body.context_summary !== undefined) allowedFields.context_summary = body.context_summary;
    if (body.exhibition_id !== undefined) allowedFields.exhibition_id = body.exhibition_id;
    if (body.exhibition !== undefined) allowedFields.exhibition = body.exhibition;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ data: null, error: { code: 'NO_FIELDS', message: 'No valid fields provided to update.' } }, { status: 400 });
    }

    // Scoped to org - prevents patching another user's lead
    const { error } = await supabaseAdmin
      .from('leads')
      .update(allowedFields)
      .eq('id', id)
      .eq('organization_id', auth.orgId);

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
