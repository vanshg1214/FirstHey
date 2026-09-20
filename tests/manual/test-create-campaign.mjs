const refreshToken = "1000.6394df61515a989c471c8623ed248f9f.b11a0e0e158dd64c0f4b69af6183a745";
const clientId = "1000.C1RHL492151WMY2HDL5JH7L142UMNV";
const clientSecret = "d445debc4dac7a9c1178dbff8bfa588834b2eba21c";

async function test() {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch("https://accounts.zoho.in/oauth/v2/token?" + params.toString(), {
    method: 'POST'
  });
  const data = await res.json();
  
  if (data.access_token) {
    const listRes = await fetch("https://campaigns.zoho.in/api/v1.1/getmailinglists?resfmt=JSON", {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${data.access_token}`
      }
    });

    const lists = await listRes.json();
    console.log("Mailing Lists response:", JSON.stringify(lists, null, 2));
    const validList = lists.list_of_details.find((l) => parseInt(l.noofcontacts || '0', 10) > 0) || lists.list_of_details[0];
    const listkey = validList.listkey;

    console.log("Testing createCampaign with listkey:", listkey);

    // Generate a fresh webhook.site URL to serve the template
    const hookRes = await fetch('https://webhook.site/token', { method: 'POST' });
    const hookToken = await hookRes.json();
    await fetch(`https://webhook.site/token/${hookToken.uuid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        default_content: '<html><body><p>$[AI_Email_Body]$</p><p>$[ZCSNIP_Unsubscribe]$</p></body></html>',
        default_content_type: 'text/html'
      })
    });
    const contentUrl = `https://webhook.site/${hookToken.uuid}`;
    console.log("Generated dynamic template URL:", contentUrl);

    // Fetch Topics
    const topicsRes = await fetch("https://campaigns.zoho.in/api/v1.1/topics?resfmt=JSON", {
      headers: { 'Authorization': `Zoho-oauthtoken ${data.access_token}` }
    });
    const topicsData = await topicsRes.json();
    console.log("Topics:", JSON.stringify(topicsData, null, 2));
    let topicId = null;
    if (topicsData && topicsData.topicDetails && topicsData.topicDetails.length > 0) {
      topicId = topicsData.topicDetails[0].topicId;
    }

    const formData = new URLSearchParams();
    formData.append('resfmt', 'JSON');
    formData.append('campaignname', 'API Test ' + Date.now());
    formData.append('from_email', 'ng@thenextdesign.com');
    formData.append('subject', 'Test');
    formData.append('list_details', JSON.stringify({ [listkey]: [] }));
    formData.append('content_url', contentUrl);
    if (topicId) {
      formData.append('topicId', topicId);
    }

    const campRes = await fetch("https://campaigns.zoho.in/api/v1.1/createCampaign", {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${data.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    console.log("Response Status:", campRes.status);
    console.log("Response Headers:", Object.fromEntries(campRes.headers.entries()));
    if (campRes.status === 200 || campRes.status === 201) {
      const campData = await campRes.json();
      console.log("Create Campaign Response:", campData);
    } else {
      console.log("Raw Response Text:", await campRes.text());
    }
  }
}

test();
