import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key loaded:', apiKey ? 'YES (starts with ' + apiKey.substring(0, 5) + ')' : 'NO');

async function test() {
  if (!apiKey) return;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
  });
  
  const prompt = "Can you read this text? Just say YES if you can.";
  try {
    const result = await model.generateContent(prompt);
    console.log('Gemini API response:', result.response.text());
  } catch (e) {
    console.error('Gemini API error:', e);
  }
}

test();
