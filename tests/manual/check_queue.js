const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkQueue() {
  const { data: jobs, error: err1 } = await supabase.from('email_queue').select('*').order('created_at', { ascending: false }).limit(5);
  const { data: followups, error: err2 } = await supabase.from('followups').select('*').order('created_at', { ascending: false }).limit(5);
  
  console.log("Email Queue:");
  console.log(jobs);
  
  console.log("\nFollowups:");
  console.log(followups);
}

checkQueue();
