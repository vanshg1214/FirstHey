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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('leads').select('context_summary').eq('id', 'c5b76c7f-062e-45c5-3e1cd0560c71').single().then(r => console.log(JSON.stringify(r.data, null, 2))).catch(console.error);
