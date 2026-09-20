import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('='))
    .map(([k, ...v]) => [k, v.join('=')])
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL.trim(), env.SUPABASE_SERVICE_ROLE_KEY.trim());

const { data, error } = await supabase
  .from('leads')
  .select('id, contact_fields, context_summary')
  .order('created_at', { ascending: false })
  .limit(5);

if (error) { console.error('Error:', error); process.exit(1); }

console.log('\n=== YOUR MOST RECENT LEADS ===\n');
data.forEach((lead, i) => {
  const name = lead.contact_fields?.name || 'Unknown';
  const email = lead.contact_fields?.email || 'No email';
  const opens = lead.context_summary?.open_count || 0;
  const history = lead.context_summary?.open_history || [];
  console.log(`[${i+1}] ${name} (${email})`);
  console.log(`     ID: ${lead.id}`);
  console.log(`     Opens: ${opens} | History entries: ${history.length}`);
  console.log(`     Test URL: http://localhost:3000/api/leads/${lead.id}/track-open?touch=1`);
  console.log('');
});
