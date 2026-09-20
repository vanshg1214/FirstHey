const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAshish() {
  const { data: leads, error: err1 } = await supabase.from('leads')
    .select('*')
    .contains('contact_fields', { email: 'guptasujal1205@gmail.com' });
    
  if (leads && leads.length > 0) {
    const { data: followups, error: err2 } = await supabase.from('followups').select('*').eq('lead_id', leads[0].id).order('sequence_position', { ascending: true });
    console.log("Followups for Ashish:");
    console.log(followups);
  }
}

checkAshish();
