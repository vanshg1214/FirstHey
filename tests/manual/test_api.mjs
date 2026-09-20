async function test() {
  const res = await fetch('http://localhost:3000/api/campaigns/d3b414a2-c73a-4272-b21f-4ba29a8a3d7d');
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

test();
