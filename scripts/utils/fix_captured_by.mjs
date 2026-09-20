import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const REAL_ORG_ID = '0ff6db78-4258-46fc-91aa-68f492eb9f6f';
  const USER_ID = '32f101af-57bd-4e89-b1c0-fa2c82e24953';

  const { data, error } = await supabaseAdmin
    .from('leads')
    .update({ captured_by: USER_ID })
    .eq('organization_id', REAL_ORG_ID)
    .is('captured_by', null)
    .select('id');

  if (error) {
    console.error('Error fixing leads:', error);
  } else {
    console.log(`Fixed ${data.length} leads.`);
  }
}

fix();
