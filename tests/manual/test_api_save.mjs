async function test() {
  const leadId = 'e44c208c-9057-4181-893f-c5763df3deec';
  
  try {
    const res = await fetch(`http://localhost:3000/api/leads/${leadId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contactFields: { name: 'Test Save', company: 'API Test' },
        cardImage: null,
        confidence: 1.0,
        campaignId: null,
        exhibition: null,
        stall: null
      }),
    });
    
    console.log('STATUS_CODE:', res.status);
    if (!res.ok) {
       console.log('Error text starts with:', (await res.text()).substring(0, 100));
    } else {
       console.log('Success:', await res.json());
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
