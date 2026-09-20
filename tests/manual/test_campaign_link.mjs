import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: campaignLeads, error } = await supabaseAdmin
    .from('campaign_leads')
    .select('*')
    .order('added_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Latest 5 campaign_leads:', JSON.stringify(campaignLeads, null, 2));
}

test();
