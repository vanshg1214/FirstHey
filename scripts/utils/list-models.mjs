import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    console.log("Fetching available models for this API key...");
    // We can fetch via the REST API to get the raw list
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.models) {
      console.log("=== AVAILABLE MODELS ===");
      data.models.forEach(m => console.log(`- ${m.name}`));
      console.log("========================");
    } else {
      console.error("No models found or error:", data);
    }
  } catch (err) {
    console.error("Error fetching models:", err);
  }
}

listModels();
