import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envLocal = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
const env = {};
envLocal.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, ...val] = line.split('=');
    env[key.trim()] = val.join('=').trim();
  }
});

const clientId = env.ZOHO_CLIENT_ID;
const clientSecret = env.ZOHO_CLIENT_SECRET;
const refreshToken = env.ZOHO_REFRESH_TOKEN;
const accountsUrl = env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in';
const campaignsUrl = env.ZOHO_CAMPAIGNS_API_URL || 'https://campaigns.zoho.in/api/v1.1';

async function testMailingLists() {
  console.log("Getting access token...");
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const tokenRes = await fetch(`${accountsUrl}/oauth/v2/token?${params.toString()}`, { method: 'POST' });
  const tokenData = await tokenRes.json();
  
  if (!tokenData.access_token) {
    console.error("Failed to get access token:", tokenData);
    return;
  }

  console.log("\nFetching mailing lists...");
  const listRes = await fetch(`${campaignsUrl}/getmailinglists?resfmt=JSON`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${tokenData.access_token}` }
  });

  const listData = await listRes.json();
  console.log("\n--- RAW ZOHO API RESPONSE ---");
  console.log(JSON.stringify(listData, null, 2));
}

testMailingLists();
