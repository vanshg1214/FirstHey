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
  console.log("Token Data:", data);

  if (data.access_token) {
    const listRes = await fetch("https://campaigns.zoho.in/api/v1.1/getmailinglists?resfmt=JSON", {
      headers: { Authorization: "Zoho-oauthtoken " + data.access_token }
    });
    console.log("List Response:", await listRes.json());
  }
}

test();
