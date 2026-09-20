import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }
    
    // Get organization
    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const { data: exhibitions, error } = await supabase
      .from('exhibitions')
      .select('*')
      .order('created_at', { ascending: false })
      .eq('organization_id', userData.organization_id);

    if (error) {
      throw new Error(`Database error fetching exhibitions: ${error.message}`);
    }

    // Get lead counts for each exhibition
    const { data: leadCounts, error: countError } = await supabaseAdmin
      .from('leads')
      .select('exhibition_id')
      .in('exhibition_id', exhibitions?.map(e => e.id) || []);

    const countMap = (leadCounts || []).reduce((acc: any, lead) => {
      if (lead.exhibition_id) {
        acc[lead.exhibition_id] = (acc[lead.exhibition_id] || 0) + 1;
      }
      return acc;
    }, {});

    const enrichedExhibitions = (exhibitions || []).map(ex => ({
      ...ex,
      lead_count: countMap[ex.id] || 0
    }));

    return NextResponse.json({
      data: enrichedExhibitions,
      error: null,
    });
  } catch (error: any) {
    console.error('Error in GET exhibitions API route:', error);
    return NextResponse.json(
      { data: null, error: { message: error.message || 'An error occurred' } },
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

    const newExhibition = {
      ...body,
      organization_id: userData.organization_id,
    };

    const { data, error } = await supabaseAdmin.from('exhibitions').insert(newExhibition).select().single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error in POST exhibitions API route:', error);
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
