import { GoogleGenerativeAI } from '@google/generative-ai';

const key1 = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_KEY_HERE'; 
const key2 = process.env.GEMINI_API_KEY_ALT || 'YOUR_ALT_GEMINI_KEY_HERE'; 

const models = ['gemini-flash-latest', 'gemini-3.1-flash-image', 'gemini-2.0-flash', 'gemini-3.5-flash'];

async function testCombination(keyName, key, modelName) {
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });
    await model.generateContent("Say hello");
    console.log(`✅ [${keyName}] + [${modelName}] = SUCCESS`);
  } catch (err) {
    if (err.message.includes('429')) {
      console.log(`❌ [${keyName}] + [${modelName}] = 429 QUOTA EXCEEDED`);
    } else if (err.message.includes('404')) {
      console.log(`❌ [${keyName}] + [${modelName}] = 404 NOT FOUND`);
    } else {
      console.log(`❌ [${keyName}] + [${modelName}] = ${err.message.split('\n')[0]}`);
    }
  }
}

async function runTests() {
  console.log("=== STARTING AGGRESSIVE QUOTA TESTS ===");
  for (const model of models) {
    await testCombination('AIzaSy Key', key1, model);
    await testCombination('AQ Key    ', key2, model);
  }
  console.log("=== DONE ===");
}

runTests();
