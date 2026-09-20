import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is missing from environment variables.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testApi() {
  console.log("Testing connection to Google Gemini API...");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent("Reply with exactly these three words: API is working!");
    console.log("================================");
    console.log("✅ SUCCESS! Response from Google:");
    console.log(result.response.text().trim());
    console.log("================================");
  } catch (err) {
    console.error("❌ API Error:", err.message || err);
  }
}

testApi();
