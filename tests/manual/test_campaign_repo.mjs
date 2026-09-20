import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const [campaignRes, leadsRes] = await Promise.all([
      supabaseAdmin
        .from('campaigns')
        .select('*')
        .eq('id', 'd3b414a2-c73a-4272-b21f-4ba29a8a3d7d')
        .single(),
      supabaseAdmin
        .from('campaign_leads')
        .select(`
          lead_id,
          added_at,
          leads (*)
        `)
        .eq('campaign_id', 'd3b414a2-c73a-4272-b21f-4ba29a8a3d7d')
        .order('added_at', { ascending: false })
    ]);
    
  console.log('campaignRes:', JSON.stringify(campaignRes, null, 2));
  console.log('leadsRes:', JSON.stringify(leadsRes, null, 2));
}

test();
