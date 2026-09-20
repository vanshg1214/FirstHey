import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: leadsRes, error } = await supabaseAdmin
        .from('campaign_leads')
        .select(`
          lead_id,
          added_at,
          leads (*)
        `)
        .eq('campaign_id', 'd3b414a2-c73a-4272-b21f-4ba29a8a3d7d')
        .order('added_at', { ascending: false });
        
  if (error) throw error;
  
  console.log('campaign_leads exactly from DB:', JSON.stringify(leadsRes, null, 2));
}

test();
