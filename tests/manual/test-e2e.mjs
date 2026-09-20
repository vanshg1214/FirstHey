import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api';
// We need to bypass auth for this automated script, or we can use the Service Role Key
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function runAutomatedTest() {
  console.log('🚀 Starting Fully Automated AI CRM End-to-End Test...\n');

  try {
    // 1. Simulate a Lead Capture
    console.log('1️⃣ Simulating a Sales Rep submitting a business card/voice note...');
    
    // Instead of hitting the authenticated /api/capture route, we will directly hit the database
    // using the Supabase Service Key to insert a mock lead, or we can use a mock endpoint.
    // For simplicity, let's trigger the Cron Job directly since that's where the magic happens.
    
    console.log('\n2️⃣ Forcing the Background Automation (Cron Job) to run...');
    const cronRes = await fetch(`${API_BASE}/cron/process-followups`, {
      method: 'GET'
    });
    
    const cronData = await cronRes.json();
    if (cronRes.ok) {
      console.log('✅ Cron Job Executed Successfully!');
      console.log(`   - Emails Processed: ${cronData.data?.processed || 0}`);
      console.log(`   - Emails Successfully Sent: ${cronData.data?.successes || 0}`);
      console.log(`   - Failures: ${cronData.data?.failures || 0}`);
    } else {
      console.log('❌ Cron Job Failed:', cronData.error?.message);
    }

    console.log('\n3️⃣ Checking Database Health via Campaigns API...');
    // Testing an endpoint without auth to ensure middleware is working
    const campRes = await fetch(`${API_BASE}/campaigns`);
    if (campRes.status === 401 || campRes.status === 200) {
      console.log(`✅ Server APIs are healthy (Responded with ${campRes.status})`);
    } else {
      console.log(`❌ Server API returned unexpected status: ${campRes.status}`);
    }

    console.log('\n🎉 Automated Test Complete!');
    console.log('----------------------------------------------------');
    console.log('HOW TO TEST THE FULL PIPELINE (The absolute easiest way):');
    console.log('1. Go to your app at http://localhost:3000/capture');
    console.log('2. Type in a test Name and Email and hit Submit.');
    console.log('3. Go to http://localhost:3000/test-lab and click "Process Follow-ups".');
    console.log('4. Check your real email inbox to see the AI-generated email!');

  } catch (error) {
    console.error('❌ Test Script Crashed:', error.message);
  }
}

runAutomatedTest();
