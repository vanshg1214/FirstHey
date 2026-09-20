import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('name', 'Testing');
    
  console.log('campaigns:', campaigns);
}

test();
