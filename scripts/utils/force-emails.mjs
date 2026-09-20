import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kpnggvuhyshtfvlnsarc.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function forceQueue() {
  console.log("Setting all queued emails to be due immediately...");
  
  // Set all 'queued' emails scheduled_for time to 2 hours ago
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabaseAdmin
    .from('followups')
    .update({ scheduled_for: twoHoursAgo })
    .eq('status', 'queued')
    .select();
    
  if (error) {
    console.error("Failed to update queue:", error);
  } else {
    console.log(`Updated ${data.length} queued emails!`);
    
    // Now hit the cron endpoint
    console.log("Triggering the cron job worker...");
    const res = await fetch('http://localhost:3000/api/cron/process-followups');
    const result = await res.json();
    console.log("Cron Result:", result);
  }
}

forceQueue();
