import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  // Find a campaign lead
  const { data: campaignLeads, error: err1 } = await supabaseAdmin
    .from('campaign_leads')
    .select('*')
    .limit(1);
    
  console.log('campaign_leads:', campaignLeads);
  
  if (campaignLeads && campaignLeads.length > 0) {
     const cl = campaignLeads[0];
     
     const { data, error, count } = await supabaseAdmin
       .from('campaign_leads')
       .delete({ count: 'exact' })
       .match({ campaign_id: cl.campaign_id, lead_id: cl.lead_id })
       .select();
       
     console.log('Delete result:', { data, error, count });
     
     // Check if it's still there
     const { data: checkData } = await supabaseAdmin
       .from('campaign_leads')
       .select('*')
       .match({ campaign_id: cl.campaign_id, lead_id: cl.lead_id });
       
     console.log('Is still there?', checkData);
  }
}

test();
