import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

async function test() {
  if (!apiKey) return;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    systemInstruction: "You are a helpful assistant.",
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  });
  
  const dummyImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const imagePart = {
    inlineData: {
      data: dummyImage,
      mimeType: 'image/png',
    },
  };
  const prompt = `Extract the contact details from this business card image and return ONLY valid JSON with these exact keys: name, company, title, email, phone, confidence_score. Use null for any field that is not visible on the card. confidence_score should be a number from 0 to 100.`;
  
  try {
    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();
    console.log('Raw output:', text);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log('Parsed successfully:', parsed);
  } catch (error) {
    console.error('Error occurred:', error);
  }
}

test();
