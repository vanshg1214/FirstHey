import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { leadIds, exhibitionName } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const orgId = userData.organization_id;

    // Verify the exhibition belongs to this org
    const { data: exhibition, error: exError } = await supabaseAdmin
      .from('exhibitions')
      .select('id')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (exError || !exhibition) {
      return NextResponse.json({ error: 'Exhibition not found or access denied' }, { status: 403 });
    }

    // Only update leads that belong to this org
    const { error } = await supabaseAdmin
      .from('leads')
      .update({ 
        exhibition_id: id, 
        exhibition: exhibitionName 
      })
      .in('id', leadIds)
      .eq('organization_id', orgId); // Critical: prevent cross-org assignment

    if (error) {
      throw new Error(`Database error updating leads: ${error.message}`);
    }

    return NextResponse.json({ success: true, count: leadIds.length });
  } catch (error: any) {
    console.error('Error bulk adding leads to exhibition:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
