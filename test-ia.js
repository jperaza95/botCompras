require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
    try {
        // Probamos con gemini-1.5-pro que es el más compatible
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const result = await model.generateContent("Hola, responde solo con la palabra OK.");
        console.log("Respuesta de Google:", result.response.text());
    } catch (e) {
        console.error("Error detallado:", e);
    }
}
test();