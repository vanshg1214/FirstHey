import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { FollowupDraftAgent } from '@/lib/agents/followupDraft';
import { SettingsService } from '@/lib/services/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customContext } = await req.json();
    
    if (!customContext) {
      return NextResponse.json({ error: 'customContext is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
    if (!userData?.organization_id) throw new Error('Organization not found');

    const settings = await SettingsService.getSettings(userData.organization_id);
    
    const { data: exhibition } = await supabaseAdmin.from('exhibitions').select('name').eq('id', id).single();

    const draft = await FollowupDraftAgent.generateDraft(
      process.env.GEMINI_API_KEY || '',
      {}, // Generic contact
      {}, // Generic context
      settings.email_from_name || 'Sales Representative',
      exhibition?.name || 'an exhibition',
      null,
      customContext,
      true // isBlast flag
    );

    return NextResponse.json({ 
      success: true, 
      draft 
    });
  } catch (error: any) {
    console.error('Blast template generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
