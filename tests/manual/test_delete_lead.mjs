import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: campaignLeads, error: err1 } = await adminClient
    .from('campaign_leads')
    .select('*')
    .limit(1);
    
  console.log('campaign_leads:', campaignLeads, err1);
  
  if (campaignLeads && campaignLeads.length > 0) {
     const cl = campaignLeads[0];
     console.log('Attempting to delete:', cl);
     
     // Test delete with anon key (simulating what might happen if RLS blocks it)
     const { error: err2 } = await supabase
       .from('campaign_leads')
       .delete()
       .match({ campaign_id: cl.campaign_id, lead_id: cl.lead_id });
       
     console.log('Delete result (anon):', err2);
     
     // Test delete with service key
     const adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
     const { error: err3 } = await adminClient
       .from('campaign_leads')
       .delete()
       .match({ campaign_id: cl.campaign_id, lead_id: cl.lead_id });
       
     console.log('Delete result (admin):', err3);
  }
}

test();
