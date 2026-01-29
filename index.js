// 1. IMPORTACIONES (Todas al principio)
import 'dotenv/config';
import express from 'express';
import { GoogleGenAI } from "@google/genai";
import pg from 'pg';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

// 2. CONFIGURACIÓN INICIAL
const { Pool } = pg;
const app = express();
const port = 3000;

// 3. CONFIGURACIÓN DE IA
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
//const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Usamos flash que es más rápido, pero puedes dejar pro si prefieres
// const modelIA = genAI.getGenerativeModel({
//     model: "gemini-1.5-flash"
// });

app.use(express.json());

// 4. CONEXIÓN A POSTGRES
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// --- RUTA HTTP ---
app.get('/licitaciones', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT id, titulo, organismo, rubro_ia, link, fecha_publicacion FROM licitaciones ORDER BY creado_en DESC');

        let html = `
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Panel de Licitaciones</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body class="container mt-5">
                <h2 class="mb-4">📋 Licitaciones Detectadas (${resultado.rowCount})</h2>
                <table class="table table-striped table-hover border">
                    <thead class="table-dark">
                        <tr>
                            <th>ID</th>
                            <th>Título</th>
                            <th>Rubro IA</th>
                            <th>Fecha</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        resultado.rows.forEach(fila => {
            html += `
                <tr>
                    <td>${fila.id}</td>
                    <td><strong>${fila.titulo}</strong></td>
                    <td><span class="badge bg-success">${fila.rubro_ia || 'Analizando...'}</span></td>
                    <td>${fila.fecha_publicacion}</td>
                    <td><a href="${fila.link}" target="_blank" class="btn btn-sm btn-outline-primary">Ver Pliego</a></td>
                </tr>
            `;
        });

        html += `</tbody></table></body></html>`;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al generar la tabla");
    }
});

// --- FUNCIONES DE LÓGICA ---
async function analizarRSS() {
    const url = generarURLRSS(); //"https://www.comprasestatales.gub.uy/consultas/rss/tipo-pub/ALL/tipo-fecha/MOD/orden/ORD_MOD/tipo-orden/DESC/rango-fecha/2026-01-15+00%3A00%3A00_2026-01-21+23%3A59%3A59";

    try {
        console.log("--- 📡 Conectando con ARCE... ---");
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
                'Accept': 'application/xml, text/xml, */*',
            }
        });

        const parser = new XMLParser();
        const jObj = parser.parse(response.data);
        const items = jObj.rss.channel.item;

        console.log(`Leídas ${items.length} licitaciones.`);

        let nuevas = 0;
        for (const item of items) {
            const query = `
                INSERT INTO licitaciones (guid, titulo, link, fecha_publicacion, descripcion)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (guid) DO NOTHING
                RETURNING id;
            `;
            const values = [item.guid || item.link, item.title, item.link, item.pubDate, item.description];
            const res = await pool.query(query, values);
            if (res.rowCount > 0) nuevas++;
        }

        console.log(`✅ Sincronización completa: ${nuevas} nuevas.`);
        await clasificarPendientes();

    } catch (error) {
        console.error("❌ Error en el proceso: ", error.message);
    }
}

async function clasificarPendientes() {
    console.log("--- 🧠 Analizando con Gemini ---");
    const res = await pool.query('SELECT id, titulo, descripcion FROM licitaciones WHERE analizado = FALSE LIMIT 10');

    for (const lic of res.rows) {
        try {
            const prompt = `Define el rubro de esta licitación uruguaya en UNA SOLA PALABRA (Ej: Software, Salud, Construcción, Limpieza).
            Título: ${lic.titulo}
            Categoría:`;

            // Cambiamos la estructura para que coincida con lo que espera @google/genai
            const result = await ai.models.generateContent({
                model: "gemini-3-flash-preview", // Te recomiendo 1.5-flash por estabilidad
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });

            // En @google/genai la respuesta está directamente en .text
            const respuestaIA = result.text.trim().replace(/[^a-zA-ZáéíóúÁÉÍÓÚ]/g, "");

            await pool.query(
                'UPDATE licitaciones SET rubro_ia = $1, analizado = TRUE WHERE id = $2',
                [respuestaIA, lic.id]
            );

            console.log(`🤖 ID ${lic.id} clasificado: ${respuestaIA}`);
        } catch (err) {
            console.error(`❌ Error en IA ID ${lic.id}:`, err.message);
        }
    }
}



function generarURLRSS() {
    const hoy = new Date();
    const hace7 = new Date();
    hace7.setDate(hoy.getDate() - 7);

    const formatoArce = (fecha, hora) => {
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        // ARCE usa %3A para los ":" en la URL
        return `${y}-${m}-${d}+${hora}`;
    };

    const fechaInicio = formatoArce(hace7, "00%3A00%3A00");
    const fechaFin = formatoArce(hoy, "23%3A59%3A59");

    return `https://www.comprasestatales.gub.uy/consultas/rss/tipo-pub/ALL/tipo-fecha/MOD/orden/ORD_MOD/tipo-orden/DESC/rango-fecha/${fechaInicio}_${fechaFin}`;
}

// 5. INICIO DEL SISTEMA
analizarRSS();

app.listen(port, () => {
    console.log(`🚀 Servidor listo en http://localhost:${port}/licitaciones`);
});