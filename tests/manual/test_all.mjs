import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: campaigns } = await supabaseAdmin.from('campaigns').select('*');
  const { data: campaignLeads } = await supabaseAdmin.from('campaign_leads').select('*');
  
  console.log('Total campaigns:', campaigns.length);
  console.log('All campaigns:', campaigns.map(c => ({ id: c.id, name: c.name })));
  console.log('Total campaign_leads:', campaignLeads.length);
  console.log('All campaign_leads:', campaignLeads);
}

test();
