import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const MOCK_ORG_ID = '738de77c-ddd0-4a71-9d8d-3e346590ca0d';
  const REAL_ORG_ID = '0ff6db78-4258-46fc-91aa-68f492eb9f6f';

  const { data, error } = await supabaseAdmin
    .from('leads')
    .update({ organization_id: REAL_ORG_ID })
    .eq('organization_id', MOCK_ORG_ID)
    .select('id, status');

  if (error) {
    console.error('Error fixing leads:', error);
  } else {
    console.log(`Fixed ${data.length} leads.`);
  }
}

fix();
