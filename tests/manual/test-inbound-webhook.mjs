import fetch from 'node-fetch';

async function testWebhook() {
  console.log('📬 Simulating incoming reply from a prospect...');

  const payload = {
    from_email: "test@example.com", // You should change this to a real lead's email in your DB if you want it to link perfectly
    subject: "Re: Following up on your database scale limitations",
    text: "Hi Sujal, I'm interested but this seems way too expensive for our current budget. Can you offer a discount?"
  };

  try {
    const res = await fetch('http://localhost:3000/api/webhooks/inbound-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', data);

    if (res.ok) {
      console.log('\n✅ Webhook successful! The Drip should be paused and an AI Rebuttal Notification should now be in your Inbox page.');
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWebhook();
