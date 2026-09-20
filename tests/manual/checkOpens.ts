import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkOpens() {
  const { data, error } = await supabase.from('followups').select('id, status, opened_at');
  if (error) {
    console.error(error);
  } else {
    console.log(data);
    const sent = data.filter(f => ['sent', 'opened'].includes(f.status)).length;
    const opened = data.filter(f => f.opened_at != null || f.status === 'opened').length;
    console.log(`Sent: ${sent}, Opened: ${opened}`);
  }
}

checkOpens();
