import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Creating default organization...");
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: 'Default Exhibition Org' })
    .select()
    .single();

  if (orgError) {
    console.error("Error creating org:", orgError);
  } else {
    console.log("Created Organization ID:", org.id);
  }

  console.log("Creating storage bucket 'audio-recordings'...");
  const { data: bucket, error: bucketError } = await supabase.storage.createBucket('audio-recordings', {
    public: true,
  });

  if (bucketError && !bucketError.message.includes('already exists')) {
    console.error("Error creating bucket:", bucketError);
  } else {
    console.log("Bucket created or already exists.");
  }
}

seed();
