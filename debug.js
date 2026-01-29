import 'dotenv/config';
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({});

async function verModelosDisponibles() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        // Esto intentará una llamada mínima
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hola");
        console.log("✅ ¡CONEXIÓN EXITOSA! La IA respondió:", result.response.text());
    } catch (error) {
        console.log("❌ ERROR DETECTADO:");
        console.log("Mensaje:", error.message);
        if (error.message.includes("404")) {
            console.log("\n💡 SUGERENCIA: Tu API Key parece no tener acceso a este modelo.");
            console.log("1. Ve a https://aistudio.google.com/");
            console.log("2. Crea una NUEVA API Key.");
            console.log("3. Asegúrate de que no haya espacios en el .env");
        }
    }
}

verModelosDisponibles();