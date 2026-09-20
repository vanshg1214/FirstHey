import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const leadId = '32894c0e-8ac8-4013-a3af-298479492247';
  
  const { data: lead } = await supabaseAdmin.from('leads').select('*').eq('id', leadId).single();
  const { data: campaignLead } = await supabaseAdmin.from('campaign_leads').select('*, leads(*)').eq('lead_id', leadId).single();
  
  console.log('Lead in leads table:', JSON.stringify(lead, null, 2));
  console.log('Lead in campaign_leads join:', JSON.stringify(campaignLead, null, 2));
}

test();
