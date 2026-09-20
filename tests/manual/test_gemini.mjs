import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY; // I'll just see if there's one in env or pass it
if (!apiKey) {
    console.log("No GEMINI_API_KEY available for test");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName) {
    console.log(`Testing ${modelName}...`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say "hello"');
        console.log(`${modelName} success:`, result.response.text());
    } catch (err) {
        console.log(`${modelName} error:`, err.message);
    }
}

async function run() {
    await testModel('gemini-3.6-flash');
    await testModel('gemini-1.5-flash');
    await testModel('gemini-flash-latest');
}

run();
