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

async function testTrack(id, touch) {
  try {
    const { data: lead, error: fetchError } = await supabase
      .from('leads')
      .select('context_summary, crm_record_id, contact_fields, organization_id')
      .eq('id', id)
      .single();

    if (fetchError) {
       console.error("fetchError:", fetchError);
       return;
    }

    if (lead) {
      console.log("Lead found:", lead.contact_fields.name);
      
      const contextSummary = lead.context_summary || {};
      const currentOpens = typeof contextSummary.open_count === 'number' ? contextSummary.open_count : 0;
      const newOpens = currentOpens + 1;
      
      const emailOpens = contextSummary.email_opens || {};
      emailOpens[touch] = (emailOpens[touch] || 0) + 1;

      const openHistory = contextSummary.open_history || [];
      const currentTimestamp = new Date().toISOString();
      openHistory.push({
        touch,
        timestamp: currentTimestamp
      });

      const isHot = newOpens >= 2;

      const updatedContext = {
        ...contextSummary,
        open_count: newOpens,
        email_opens: emailOpens,
        open_history: openHistory,
        is_hot: isHot,
      };

      const {error: updateError} = await supabase
        .from('leads')
        .update({ 
          context_summary: updatedContext,
          last_engagement_at: new Date().toISOString(),
          total_emails_opened: newOpens
        })
        .eq('id', id);

      if (updateError) console.error("updateError:", updateError);
      else console.log("Successfully updated lead");
    }
  } catch (error) {
    console.error('Error tracking email open:', error);
  }
}

testTrack('011f71f1-f4f8-41e3-b9bf-4657438bda48', '1');
