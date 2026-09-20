import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const eqIdx = line.indexOf('=');
  if (eqIdx > -1) acc[line.substring(0, eqIdx).trim()] = line.substring(eqIdx + 1).trim();
  return acc;
}, {});

console.log('--- Config Check ---');
console.log('Client ID:', env.ZOHO_CLIENT_ID || 'MISSING');
console.log('Client Secret:', env.ZOHO_CLIENT_SECRET ? '***SET***' : 'MISSING');
console.log('Refresh Token:', env.ZOHO_REFRESH_TOKEN ? '***SET***' : 'MISSING');
console.log('Accounts URL:', env.ZOHO_ACCOUNTS_URL || 'MISSING');
console.log('');

async function fullTest() {
  // STEP 1: Refresh token
  const tokenParams = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    refresh_token: env.ZOHO_REFRESH_TOKEN,
  });
  
  const tokenRes = await fetch((env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in') + '/oauth/v2/token?' + tokenParams.toString(), { method: 'POST' });
  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    console.error('FAILED at Step 1: Token refresh failed:', JSON.stringify(tokenData));
    return;
  }
  console.log('Step 1 PASSED: Got fresh access token');

  // STEP 2: Fetch mailing lists
  const listsRes = await fetch('https://campaigns.zoho.in/api/v1.1/getmailinglists?resfmt=JSON', {
    headers: { 'Authorization': 'Zoho-oauthtoken ' + tokenData.access_token }
  });
  const listsData = await listsRes.json();
  
  if (!listsData.list_of_details) {
    console.error('FAILED at Step 2: Could not fetch lists:', JSON.stringify(listsData));
    return;
  }
  console.log('Step 2 PASSED: Fetched', listsData.list_of_details.length, 'mailing lists:', listsData.list_of_details.map(l => l.listname).join(', '));
  
  // STEP 3: Find "Apexora Leads"
  const targetList = listsData.list_of_details.find(l => l.listname.toLowerCase() === 'apexora leads');
  if (!targetList) {
    console.error('FAILED at Step 3: Apexora Leads list not found. Available lists:', listsData.list_of_details.map(l => l.listname).join(', '));
    return;
  }
  console.log('Step 3 PASSED: Found list', targetList.listname, 'with key:', targetList.listkey);
  
  // STEP 4: Push a test subscriber
  const formData = new URLSearchParams();
  formData.append('resfmt', 'JSON');
  formData.append('listkey', targetList.listkey);
  formData.append('contactinfo', JSON.stringify({
    'Contact Email': 'final_test_' + Date.now() + '@example.com',
    'First Name': 'FinalTest'
  }));

  const addRes = await fetch('https://campaigns.zoho.in/api/v1.1/json/listsubscribe', {
    method: 'POST',
    headers: { 
      'Authorization': 'Zoho-oauthtoken ' + tokenData.access_token, 
      'Content-Type': 'application/x-www-form-urlencoded' 
    },
    body: formData.toString()
  });
  const addData = await addRes.json();
  
  if (addData.status === 'success' || addData.code === '0') {
    console.log('Step 4 PASSED: Contact successfully pushed to Zoho! Message:', addData.message);
    console.log('');
    console.log('=== ALL TESTS PASSED. THE PIPELINE IS WORKING. ===');
  } else {
    console.error('FAILED at Step 4 (addSubscriberToList):', JSON.stringify(addData));
  }
}

fullTest().catch(console.error);
