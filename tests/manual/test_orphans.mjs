import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: leads, error: err } = await supabaseAdmin
    .from('campaign_leads')
    .select('*, leads(id, contact_fields)');
    
  console.log('campaign_leads with related lead:', JSON.stringify(leads, null, 2));
}

test();
