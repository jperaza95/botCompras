import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

// --- 1. CONFIGURACIÓN DEL SERVIDOR ---
const app = express();
const PORT = process.env.PORT || 5000; // Usamos 5000 para no chocar con React (3000)

// Middleware
app.use(express.json());

// Configuración de CORS (Permite que React se comunique con este servidor)
const whitelist = ['http://localhost:3000', 'http://localhost:5173']; // 3000 (CRA), 5173 (Vite)
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log("Bloqueado por CORS:", origin);
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true
}));

// --- 2. BASE DE DATOS ---
const { Pool } = pg;
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// --- 3. LÓGICA DE NEGOCIO (DICCIONARIO) ---
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
        if (puntos > 0) puntuaciones[rubro] = puntos;
    }

    if (Object.keys(puntuaciones).length === 0) return 'Otros';
    return Object.entries(puntuaciones).sort((a, b) => b[1] - a[1])[0][0];
}

// --- 4. LÓGICA DE RSS ---
function generarURLRSS() {
    const hoy = new Date();
    const hace7 = new Date();
    hace7.setDate(hoy.getDate() - 7);

    const formatoArce = (fecha, hora) => {
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}+${hora}`;
    };
    
    return `https://www.comprasestatales.gub.uy/consultas/rss/tipo-pub/LLAM/tipo-fecha/MOD/orden/ORD_MOD/tipo-orden/DESC/rango-fecha/${formatoArce(hace7, "00%3A00%3A00")}_${formatoArce(hoy, "23%3A59%3A59")}`;
}

async function procesarLicitaciones() {
    const url = generarURLRSS();
    try {
        console.log("--- 📡 Iniciando sincronización RSS... ---");
        const config = {
              headers: {
                  // Le decimos: "Hola, soy Google Chrome en Windows, no soy un robot"
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  // Le decimos que aceptamos XML (formato del RSS)
                  'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                  // Le decimos que preferimos español
                  'Accept-Language': 'es-419,es;q=0.9',
                  // Mantenemos la conexión viva
                  'Connection': 'keep-alive'
              }
          };

        const response = await axios.get(url, config);
        const parser = new XMLParser();
        const items = parser.parse(response.data).rss.channel.item || [];

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

        console.log(`✅ ${nuevas} nuevas licitaciones.`);
        await clasificarPendientes();
        return { total: items.length, nuevas };

} catch (error) {

        if (error.response) {
             console.error(`❌ Error del Servidor ARCE: ${error.response.status} - ${error.response.statusText}`);
        } else {
             console.error("❌ Error de conexión:", error.message);
        }
        throw error;
    }
}

async function clasificarPendientes() {
    const res = await pool.query('SELECT id, guid, titulo, descripcion FROM licitaciones WHERE analizado = FALSE');
    let clasificadas = 0;

    for (const lic of res.rows) {
        let rubro = clasificarPorDiccionario(lic.titulo, lic.descripcion);
        if (!rubro) rubro = "Otros";

        await pool.query(
            'UPDATE licitaciones SET rubro_ia = $1, analizado = TRUE WHERE id = $2',
            [rubro, lic.id]
        );
        console.log(`  ✓ ${lic.guid} → ${rubro}`);
        clasificadas++;
    }
    console.log(`✨ Se clasificaron ${clasificadas} pendientes.`);
}

// --- 5. RUTAS DE LA API (ENDPOINTS) ---

// GET: Listar licitaciones
app.get('/api/licitaciones', async (req, res) => {
    try {
        const busqueda = req.query.buscar || '';
        const rubro = req.query.rubro || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        let baseQuery = `FROM licitaciones WHERE 1=1`;
        const params = [];

        if (busqueda) {
            baseQuery += ` AND titulo ILIKE $${params.length + 1}`;
            params.push(`%${busqueda}%`);
        }

        if (rubro && rubro !== 'Todos') {
            baseQuery += ` AND rubro_ia = $${params.length + 1}`;
            params.push(rubro);
        }

        // Obtener total de registros para paginación
        const countResult = await pool.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
        const total = parseInt(countResult.rows[0].total);

        // Obtener licitaciones con orden, limit y offset
        const querySQL = `SELECT id, titulo, organismo, rubro_ia, link, fecha_publicacion ${baseQuery} ORDER BY fecha_publicacion DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const resultado = await pool.query(querySQL, params);
        res.json({
            data: resultado.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener datos' });
    }
});

// GET: Lista de rubros (para el filtro del frontend)
app.get('/api/rubros', async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT DISTINCT rubro_ia FROM licitaciones WHERE rubro_ia IS NOT NULL ORDER BY rubro_ia'
        );
        res.json(resultado.rows.map(row => row.rubro_ia));
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener rubros' });
    }
});

// POST: Forzar sincronización manual desde el Frontend
app.post('/api/sincronizar', async (req, res) => {
    try {
        const resultado = await procesarLicitaciones();
        res.json({ success: true, mensaje: 'Sincronización completada', ...resultado });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al sincronizar' });
    }
});

// GET: Health Check
app.get('/api/health', (req, res) => res.send('API funcionando 🚀'));

// --- 6. INICIAR SERVIDOR ---

// Ejecutamos una carga inicial al arrancar (opcional)
procesarLicitaciones();

app.listen(PORT, () => {
    console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
    console.log(`🔧 Frontend permitido desde: ${whitelist.join(', ')}`);
});