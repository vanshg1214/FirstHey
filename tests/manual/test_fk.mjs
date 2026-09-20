import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const fakeId = '11111111-1111-1111-1111-111111111111';
  const campaignId = 'd3b414a2-c73a-4272-b21f-4ba29a8a3d7d';
  
  // Insert an orphaned record. If this throws a FK error, we know there's a FK.
  const { error: insertError } = await supabaseAdmin.from('campaign_leads').insert({
    campaign_id: campaignId,
    lead_id: fakeId
  });
  
  if (insertError) {
    console.log('Insert Error:', insertError.message);
    return;
  }
  
  // Fetch it back
  const { data, error } = await supabaseAdmin
    .from('campaign_leads')
    .select('*, leads(*)')
    .eq('lead_id', fakeId);
    
  console.log('Result for orphaned record:', JSON.stringify(data, null, 2));
  
  // Clean up
  await supabaseAdmin.from('campaign_leads').delete().eq('lead_id', fakeId);
}

test();
