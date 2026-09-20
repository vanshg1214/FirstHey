const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAshishQueue() {
  const { data: leads, error: err1 } = await supabase.from('leads')
    .select('*')
    .contains('contact_fields', { email: 'guptasujal1205@gmail.com' });
    
  if (leads && leads.length > 0) {
    const { data: queue, error: err2 } = await supabase.from('email_queue').select('*').eq('lead_id', leads[0].id).order('scheduled_for', { ascending: true });
    console.log("Queue for Ashish:");
    console.log(queue);
  }
}

checkAshishQueue();
