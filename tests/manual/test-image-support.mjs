import { GoogleGenerativeAI } from '@google/generative-ai';

const key = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_KEY_HERE';
const genAI = new GoogleGenerativeAI(key);

async function testImage() {
  console.log("Testing gemini-3.5-flash with image...");
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    
    // Create a tiny 1x1 transparent PNG pixel base64 string
    const tinyImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    
    const imagePart = {
      inlineData: {
        data: tinyImageBase64,
        mimeType: 'image/png'
      }
    };
    
    const result = await model.generateContent(["Describe this image", imagePart]);
    console.log("✅ SUCCESS! Response:", result.response.text());
  } catch (err) {
    console.error("❌ FAILED:", err.message);
  }
}

testImage();
