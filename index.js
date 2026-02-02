// 1. IMPORTACIONES (Todas al principio)
import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

// 2. CONFIGURACIÓN INICIAL
const { Pool } = pg;
const app = express();
const port = 3000;


app.use(express.json());

// 4. CONEXIÓN A POSTGRES
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// --- 1. DICCIONARIO DE RUBROS ---
const DICCIONARIO_RUBROS = {
  'Seguridad': {
    palabras: ['alarma', 'vigilancia', 'monitoreo', 'cámara', 'seguridad', 'custodia', 'sereno', 'guardia'],
    peso: 2
  },
  'Informática': {
    palabras: ['impresora', 'cartucho', 'toner', 'computadora', 'software', 'hardware', 'servidor', 'router', 'switch', 'notebook', 'laptop', 'licencia', 'ups', 'scanner'],
    peso: 2
  },
  'Oficina': {
    palabras: ['papel', 'librería', 'oficina', 'escritorio', 'resma', 'bibliorato', 'tinta', 'bolígrafo', 'silla', 'mueble'],
    peso: 1
  },
  'Limpieza': {
    palabras: ['limpieza', 'aseo', 'hipoclorito', 'jabon', 'detergente', 'papel higienico', 'residuos', 'fumigación', 'desinfección'],
    peso: 2
  },
  'Salud': {
    palabras: ['medicamento', 'farmacia', 'hospital', 'clínica', 'médico', 'suero', 'jeringa', 'paciente', 'asse', 'laboratorio', 'reactivo'],
    peso: 2
  },
  'Construcción': {
    palabras: ['obra', 'reparación', 'albañilería', 'pintura', 'cemento', 'arquitectura', 'remodelación', 'impermeabilización', 'eléctrica', 'sanitaria', 'vidrio'],
    peso: 2
  },
  'Vehículos': {
    palabras: ['vehículo', 'camioneta', 'auto', 'motor', 'neumático', 'cubierta', 'aceite', 'mantenimiento de flota', 'taller mecánico', 'repuesto'],
    peso: 2
  },
  'Alimentos': {
    palabras: ['alimento', 'comida', 'víveres', 'carne', 'verdura', 'cocina', 'merienda', 'bebida', 'supermercado'],
    peso: 2
  }
};


// --- 2. FUNCIÓN DE CLASIFICACIÓN (Solo Diccionario) ---
function clasificarPorDiccionario(titulo, descripcion) {
    const texto = `${titulo} ${descripcion}`.toLowerCase();
    const puntuaciones = {};

    for (const [rubro, config] of Object.entries(DICCIONARIO_RUBROS)) {
        let puntos = 0;
        for (const palabra of config.palabras) {
            if (texto.includes(palabra.toLowerCase())) {
                puntos += config.peso;
            }
        }
        if (puntos > 0) {
            puntuaciones[rubro] = puntos;
        }
    }

    // Si no encontró nada, devuelve null (para que luego asignemos "Otros")
    if (Object.keys(puntuaciones).length === 0) return null;

    // Retorna el rubro con mayor puntaje
    return Object.entries(puntuaciones).sort((a, b) => b[1] - a[1])[0][0];
}


// --- RUTA HTTP ---
app.get('/licitaciones', async (req, res) => {
    try {
        const busqueda = req.query.buscar || '';
        const querySQL = `
            SELECT id, titulo, organismo, rubro_ia, link, fecha_publicacion 
            FROM licitaciones 
            WHERE titulo ILIKE $1 
            ORDER BY creado_en DESC 
        `;
        const resultado = await pool.query(querySQL, [`%${busqueda}%`]);

        let html = `
            <html>
            <head>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <title>Panel de Licitaciones</title>
            </head>
            <body class="container mt-5">
                <h2>📋 Licitaciones (${resultado.rowCount})</h2>
                <form action="/licitaciones" method="GET" class="mb-3">
                    <input type="text" name="buscar" class="form-control" placeholder="Buscar por título..." value="${busqueda}">
                </form>
                <table class="table table-striped table-hover">
                    <thead class="table-dark"><tr><th>Título</th><th>Rubro (Diccionario)</th><th>Acción</th></tr></thead>
                    <tbody>
        `;
        resultado.rows.forEach(fila => {
            // Color distinto si es "Otros"
            const badgeColor = fila.rubro_ia === 'Otros' ? 'bg-secondary' : 'bg-success';
            
            html += `<tr>
                <td>${fila.titulo}</td>
                <td><span class="badge ${badgeColor}">${fila.rubro_ia || 'Pendiente'}</span></td>
                <td><a href="${fila.link}" target="_blank" class="btn btn-sm btn-outline-primary">Ver</a></td>
            </tr>`;
        });
        html += `</tbody></table></body></html>`;
        res.send(html);
    } catch (err) { res.status(500).send("Error"); }
});

// --- FUNCIONES DE LÓGICA ---
// --- PROCESO PRINCIPAL ---
async function analizarRSS() {
    const url = generarURLRSS();

    try {
        console.log("--- 📡 Conectando con ARCE... ---");
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
                'Accept': 'application/xml, text/xml, */*',
            }
        });

        const parser = new XMLParser();
        const items = parser.parse(response.data).rss.channel.item || [];
        
        console.log(`Leídas ${items.length} licitaciones del RSS.`);

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

        console.log(`✅ ${nuevas} nuevas insertadas.`);
        
        // Ejecutamos clasificación local
        await clasificarPendientes();

    } catch (error) { console.error("Error en proceso:", error); }
}

async function clasificarPendientes() {
    console.log("--- 📚 Clasificando con Diccionario Local ---");
    
    // Traemos todo lo que no esté analizado
    const res = await pool.query('SELECT id, titulo, descripcion FROM licitaciones WHERE analizado = FALSE');

    for (const lic of res.rows) {
        // 1. Intentamos clasificar
        let rubro = clasificarPorDiccionario(lic.titulo, lic.descripcion);
        
        // 2. Si es null, forzamos "Otros"
        if (!rubro) {
            rubro = "Otros";
        }

        // 3. Guardamos en DB
        await pool.query(
            'UPDATE licitaciones SET rubro_ia = $1, analizado = TRUE WHERE id = $2',
            [rubro, lic.id]
        );
        
        // Log para ver qué está pasando (Opcional, puedes quitarlo si hay mucho ruido)
         console.log(`ID ${lic.id} -> ${rubro}`);
    }
    console.log(`✨ Se clasificaron ${res.rows.length} licitaciones.`);
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