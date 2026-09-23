import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: profile, error } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    // Combine database user info with Auth metadata for the name
    const enrichedProfile = {
      ...profile,
      name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      avatar_url: user.user_metadata?.avatar_url || ''
    };

    return NextResponse.json({ data: enrichedProfile, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { name, password } = await req.json();

    const updatePayload: any = {};
    if (password) {
      updatePayload.password = password;
    }
    if (name !== undefined) {
      updatePayload.data = { full_name: name, name: name }; // update metadata
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: authError } = await supabase.auth.updateUser(updatePayload);
      if (authError) throw authError;
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    console.error('Profile Update Error:', error);
    return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  }
}

