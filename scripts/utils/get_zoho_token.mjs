const fetchToken = async () => {
  // 1. PASTE YOUR KEYS HERE:
  const clientId = "1000.C1RHL492151WMY2HDL5JH7L142UMNV";
  const clientSecret = "d445debc4dac7a9c1178dbff8bfa588834b2eba21c";
  const grantToken = "1000.12d50ea87a90daa9586f9a4c787970f7.7f15b2f1c57ab94b50d701d371166281";

  // 2. RUN THIS FILE IN TERMINAL: node get_zoho_token.mjs

  console.log("Fetching refresh token...");

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('code', grantToken);

    const response = await fetch("https://accounts.zoho.in/oauth/v2/token", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();
    console.log("\n--- ZOHO RESPONSE ---");
    console.log(data);

    if (data.refresh_token) {
      console.log("\nSUCCESS! Your Refresh Token is:");
      console.log(data.refresh_token);
    } else {
      console.log("\nERROR: No refresh token found. Ensure your Grant Code is new and hasn't expired.");
    }
  } catch (error) {
    console.error("Network Error:", error);
  }
};

fetchToken();
