import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }
    
    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .eq('captured_by', user.id);

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: leads, error } = await query;

    if (error) {
      throw new Error(`Database error fetching leads: ${error.message}`);
    }

    return NextResponse.json({
      data: leads || [],
      error: null,
    });
  } catch (error: any) {
    console.error('Error in GET leads API route:', error);
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'FETCH_LEADS_FAILED',
          message: error.message || 'An error occurred while fetching leads.',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
    
    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const newLead = {
      ...body,
      organization_id: userData.organization_id,
      captured_by: user.id,
      source: body.source || 'manual',
      status: body.status || 'new',
    };

    const { data, error } = await supabaseAdmin.from('leads').insert(newLead).select().single();

    if (error) throw new Error(error.message);

    // ZOHO CRM SYNC REMOVED FOR FIRSTHEY

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error in POST leads API route:', error);
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(updateFields)
      .eq('id', id)
      .eq('organization_id', userData.organization_id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error in PUT leads API route:', error);
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Lead IDs array is required' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Use admin client to bypass RLS and ensure cascade deletions work properly, but constrain by organization_id
    const { supabaseAdmin } = await import('@/lib/supabase');
    const { error } = await supabaseAdmin
      .from('leads')
      .delete()
      .in('id', ids)
      .eq('organization_id', userData.organization_id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error: any) {
    console.error('Error in DELETE leads API route:', error);
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
