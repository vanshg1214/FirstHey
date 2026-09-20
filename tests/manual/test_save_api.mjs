async function test() {
  const leadId = "e5f0d3a5-1c5c-433b-85bd-449be88a8ba1";
  const url = `http://localhost:3000/api/leads/${leadId}/save`;
  
  console.log('Sending POST to', url);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contactFields: {},
      })
    });
    
    console.log('STATUS:', response.status);
    const text = await response.text();
    console.log('RESPONSE:', text.substring(0, 500));
  } catch (err) {
    console.error('FETCH ERROR:', err);
  }
}

test();
