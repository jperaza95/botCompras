import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';

// ============================================================
// 1. CONFIGURACIÓN DEL SERVIDOR
// ============================================================
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

const whitelist = ['http://localhost:3000', 'http://localhost:5173'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || whitelist.includes(origin)) {
            callback(null, true);
        } else {
            console.log('Bloqueado por CORS:', origin);
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true
}));

// ============================================================
// 2. BASE DE DATOS
// ============================================================
const { Pool } = pg;
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

/**
 * Crea las tablas si no existen.
 * Agrega columnas nuevas del scraper si ya existía la tabla.
 */
async function inicializarDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS licitaciones (
            id                  SERIAL PRIMARY KEY,
            guid                TEXT UNIQUE NOT NULL,
            titulo              TEXT,
            link                TEXT,
            fecha_publicacion   TIMESTAMPTZ,
            descripcion         TEXT,
            -- Campos del scraper
            organismo           TEXT,
            unidad_ejecutora    TEXT,
            tipo_licitacion     TEXT,
            fecha_apertura      TIMESTAMPTZ,
            lugar_apertura      TEXT,
            lugar_entrega       TEXT,
            precio_pliego       TEXT,
            prorrogas_hasta     TIMESTAMPTZ,
            aclaraciones_hasta  TIMESTAMPTZ,
            estado_resolucion   TEXT,
            nro_resolucion      TEXT,
            fecha_resolucion    TIMESTAMPTZ,
            monto_total         NUMERIC,
            fondos_rotatorios   BOOLEAN,
            contacto_nombre     TEXT,
            contacto_email      TEXT,
            contacto_telefono   TEXT,
            url_pliego          TEXT,
            -- Control interno
            rubro_ia            TEXT,
            analizado           BOOLEAN DEFAULT FALSE,
            scrapeado           BOOLEAN DEFAULT FALSE,
            error_scraping      TEXT,
            fecha_scraping      TIMESTAMPTZ,
            created_at          TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    console.log('✅ Tabla licitaciones lista.');
}

// ============================================================
// 3. DICCIONARIO DE RUBROS
// ============================================================
const DICCIONARIO_RUBROS = {
    'Seguridad': {
        palabras: ['alarma', 'vigilancia', 'monitoreo', 'cámara', 'seguridad', 'custodia', 'sereno', 'guardia'],
        peso: 2
    },
    'Informática': {
        palabras: ['impresora', 'cartucho', 'toner', 'computadora', 'software', 'hardware', 'servidor', 'router',
                   'switch', 'notebook', 'laptop', 'licencia', 'ups', 'scanner', 'insumos informáticos'],
        peso: 2
    },
    'Oficina': {
        palabras: ['papel', 'librería', 'oficina', 'escritorio', 'resma', 'bibliorato', 'tinta', 'bolígrafo',
                   'silla', 'mueble', 'mobiliario'],
        peso: 1
    },
    'Limpieza': {
        palabras: ['limpieza', 'aseo', 'hipoclorito', 'jabon', 'detergente', 'papel higienico', 'residuos',
                   'fumigación', 'desinfección'],
        peso: 2
    },
    'Salud': {
        palabras: ['medicamento', 'farmacia', 'hospital', 'clínica', 'médico', 'suero', 'jeringa', 'paciente',
                   'asse', 'laboratorio', 'reactivo'],
        peso: 2
    },
    'Construcción': {
        palabras: ['obra', 'reparación', 'albañilería', 'pintura', 'cemento', 'arquitectura', 'remodelación',
                   'impermeabilización', 'eléctrica', 'sanitaria', 'vidrio', 'relleno sanitario', 'tuberías'],
        peso: 2
    },
    'Vehículos': {
        palabras: ['vehículo', 'camioneta', 'auto', 'motor', 'neumático', 'cubierta', 'aceite',
                   'mantenimiento de flota', 'taller mecánico', 'repuesto'],
        peso: 2
    },
    'Alimentos': {
        palabras: ['alimento', 'comida', 'víveres', 'carne', 'verdura', 'cocina', 'merienda', 'bebida',
                   'supermercado', 'canasta'],
        peso: 2
    }
};

function clasificarPorDiccionario(datosLicitacion = {}) {
    // Construir texto con TODOS los campos disponibles
    const campos = [
        datosLicitacion.titulo || '',
        datosLicitacion.descripcion || '',
        datosLicitacion.organismo || '',
        datosLicitacion.unidadEjecutora || '',
        datosLicitacion.tipoLicitacion || '',
        datosLicitacion.lugarApertura || '',
        datosLicitacion.lugarEntrega || '',
        datosLicitacion.precioPliego || '',
        datosLicitacion.contactoNombre || '',
        datosLicitacion.nroResolucion || '',
        datosLicitacion.estadoResolucion || '',
        datosLicitacion.urlPliego || ''
    ];
    
    const texto = campos.join(' ').toLowerCase();
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

// ============================================================
// 4. LÓGICA RSS  (últimos 30 días, todos los llamados)
// ============================================================
const AXIOS_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    'Accept-Language': 'es-419,es;q=0.9',
    'Connection': 'keep-alive'
};

function generarURLRSS(diasAtras = 30) {
    const hoy = new Date();
    const desde = new Date();
    desde.setDate(hoy.getDate() - diasAtras);

    const fmt = (fecha, hora) => {
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}+${hora}`;
    };

    // tipo-pub/LLAM = todos los llamados (no sólo licitaciones públicas)
    return `https://www.comprasestatales.gub.uy/consultas/rss/tipo-pub/LLAM/tipo-fecha/MOD/orden/ORD_MOD/tipo-orden/DESC/rango-fecha/${fmt(desde, '00%3A00%3A00')}_${fmt(hoy, '23%3A59%3A59')}`;
}

let ultimaSincronizacion = new Date(0);
let ultimasNuevasLicitaciones = 0;

async function procesarRSS() {
    const url = generarURLRSS(30);
    const timestampSincronizacion = new Date();

    try {
        console.log('📡 Sincronizando RSS (últimos 30 días)...');
        const response = await axios.get(url, { headers: AXIOS_HEADERS, timeout: 30000 });

        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(response.data);
        const channel = parsed?.rss?.channel;
        if (!channel) throw new Error('RSS sin canal válido');

        // fast-xml-parser devuelve array si hay múltiples items, objeto si hay uno solo
        const rawItems = channel.item || [];
        const items = Array.isArray(rawItems) ? rawItems : [rawItems];

        let nuevas = 0;
        for (const item of items) {
            const guid = item.guid || item.link;
            const fechaPublicacion = new Date(item.pubDate).toISOString();

            const query = `
                INSERT INTO licitaciones (guid, titulo, link, fecha_publicacion, descripcion)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (guid) DO NOTHING
                RETURNING id;
            `;
            const res = await pool.query(query, [
                guid,
                item.title,
                item.link,
                fechaPublicacion,
                item.description
            ]);
            if (res.rowCount > 0) nuevas++;
        }

        console.log(`✅ RSS: ${items.length} procesados, ${nuevas} nuevas.`);
        ultimaSincronizacion = timestampSincronizacion;
        ultimasNuevasLicitaciones = nuevas;

        return { total: items.length, nuevas };

    } catch (error) {
        if (error.response) {
            console.error(`❌ Error ARCE RSS: ${error.response.status} - ${error.response.statusText}`);
        } else {
            console.error('❌ Error RSS:', error.message);
        }
        throw error;
    }
}

// ============================================================
// 5. SCRAPER DE DETALLE (VERSIÓN DEFINITIVA / ANTI-TREN)
// ============================================================

function extraerCampoHTML($, label) {
    // Buscamos cualquier elemento que contenga la etiqueta (con o sin dos puntos)
    const elementoLabel = $("b, strong, span, td, div").filter(function() {
        const t = $(this).text().trim().toLowerCase();
        return t === label.toLowerCase() || t === (label.toLowerCase() + ":");
    }).first();

    if (elementoLabel.length > 0) {
        // Obtenemos el texto del contenedor padre para tener el contexto completo
        let textoContexto = elementoLabel.parent().text();
        
        // Cortamos para quedarnos solo con lo que sigue a la etiqueta
        let partes = textoContexto.split(new RegExp(label + ":?", "i"));
        let valorRaw = partes.length > 1 ? partes[1] : "";

        // LISTA DE CORTE: Si encontramos otra etiqueta, cortamos el "efecto tren"
        const stops = ["Lugar", "Fecha", "Prórroga", "Aclaración", "Información", "Precio", "Resolución", "Monto"];
        for (let s of stops) {
            if (valorRaw.includes(s)) valorRaw = valorRaw.split(s)[0];
        }

        let valor = valorRaw.trim();
        // Limpieza de JavaScript inyectado por ARCE
        if (valor) {
            valor = valor.replace(/if\s?\(window[\s\S]*|window\.top[\s\S]*/gi, '');
            valor = valor.replace(/\s\s+/g, ' ').trim();
        }
        return (valor && valor !== ":" && valor.length > 1) ? valor : null;
    }
    return null;
}

// --- FUNCIONES AUXILIARES DE CONVERSIÓN ---

function parsearFechaARCE(texto) {
    if (!texto) return null;
    // Busca el patrón DD/MM/YYYY HH:mm
    const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (!match) return null;
    const [, d, mo, y, h, mi] = match;
    // Retorna un objeto Date válido (ISO)
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:00`);
}

function parsearMonto(texto) {
    if (!texto) return null;
    // Elimina todo lo que no sea número, coma o punto
    const limpio = texto.replace(/[^0-9,.]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(limpio);
    return isNaN(num) ? null : num;
}

async function scrapearDetalle(url) {
    const response = await axios.get(url, { headers: AXIOS_HEADERS, timeout: 30000 });
    const $ = cheerio.load(response.data);

    // 1. LIMPIEZA TOTAL DE SCRIPTS (Adiós al código JS en los campos)
    $('script, style, noscript, iframe').remove();

    // 2. TÍTULO Y ORGANISMO (Lógica mejorada para OSE/Colonia)
    const h2Texto = $('h2').first().text().trim();
    const partesH2 = h2Texto.split(/ - | \| /).map(s => s.trim());
    
    let tipoLicitacion = partesH2[0] || "No especificado";
    // El organismo suele ser la segunda parte; si no existe, usamos la primera.
    let organismo = partesH2[1] || partesH2[0];
    let unidadEjecutora = partesH2[2] || null;

    // 3. EXTRACCIÓN DE CONTACTO (Lógica de anclaje por Email)
    let contactoNombre = null, contactoEmail = null, contactoTelefono = null;
    
    // Buscamos en el bloque específico de contacto de ARCE
    const bloqueContacto = $(".informacion-contacto, #informacion-contacto, .consultas-llamado").text() || $('body').text();
    const emailMatch = bloqueContacto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

    if (emailMatch) {
        contactoEmail = emailMatch[0];
        // El nombre suele estar justo ANTES del email en la misma línea
        const lineas = bloqueContacto.split('\n');
        const lineaEmail = lineas.find(l => l.includes(contactoEmail));
        if (lineaEmail) {
            const antesEmail = lineaEmail.split(contactoEmail)[0].trim();
            // Si el nombre parece basura (título de página), lo ignoramos
            if (antesEmail.length > 2 && !antesEmail.includes('ARCE |')) {
                contactoNombre = antesEmail;
            }
            // El teléfono suele estar después del email o cerca
            const telMatch = lineaEmail.match(/(\d[\d\s-]{6,15})/);
            if (telMatch) contactoTelefono = telMatch[0].trim();
        }
    }

    // 4. PRECIO DEL PLIEGO (Limpieza extra)
    let precioStr = extraerCampoHTML($, 'Precio');
    if (precioStr) {
        // Si el precio trae Acto de Apertura pegado, cortamos
        if (precioStr.includes('Acto')) precioStr = precioStr.split('Acto')[0].trim();
    }

    // 5. RESOLUCIÓN Y MONTO
    let estadoResolucion = extraerCampoHTML($, 'Estado Resolución');
    let nroResolucion = extraerCampoHTML($, 'Resolución') || extraerCampoHTML($, 'Nro Resolución');
    let fechaResolucion = parsearFechaARCE(extraerCampoHTML($, 'Fecha Resolución'));
    let montoTotal = parsearMonto(extraerCampoHTML($, 'Monto'));
    let fondosRotatorios = extraerCampoHTML($, 'Fondos Rotatorios')?.toLowerCase().includes('sí');

    return {
        organismo,
        unidadEjecutora,
        tipoLicitacion,
        fechaPublicacion: parsearFechaARCE(extraerCampoHTML($, 'Fecha Publicación')),
        fechaApertura: parsearFechaARCE(extraerCampoHTML($, 'Acto de Apertura') || extraerCampoHTML($, 'Recepción de ofertas hasta')),
        lugarApertura: extraerCampoHTML($, 'Lugar acto de Apertura'),
        lugarEntrega: extraerCampoHTML($, 'Lugar de entrega de ofertas'),
        precioPliego: precioStr,
        prorrogasHasta: parsearFechaARCE(extraerCampoHTML($, 'Prórrogas hasta el')),
        aclaracionesHasta: parsearFechaARCE(extraerCampoHTML($, 'Aclaraciones hasta el')),
        estadoResolucion,
        nroResolucion,
        fechaResolucion,
        montoTotal,
        fondosRotatorios,
        contactoNombre,
        contactoEmail,
        contactoTelefono,
        urlPliego: null // (Aquí va tu lógica de links ya existente)
    };
}

// ============================================================
// 6. COLA DE SCRAPING EN BACKGROUND
// ============================================================

let scrapeandoEnCurso = false;

/**
 * Procesa de a BATCH_SIZE licitaciones no scrapeadas por ciclo.
 * Se llama periódicamente por setInterval.
 */
async function procesarColaScraping(batchSize = 3) {
    if (scrapeandoEnCurso) {
        console.log('⏳ Scraping ya en curso, salteando ciclo.');
        return;
    }
    scrapeandoEnCurso = true;

    try {
        const pendientes = await pool.query(`
            SELECT id, guid, titulo, link, descripcion
            FROM licitaciones
            WHERE scrapeado = FALSE AND link IS NOT NULL
            ORDER BY fecha_publicacion DESC
            LIMIT $1
        `, [batchSize]);

        if (pendientes.rows.length === 0) {
            console.log('✨ No hay licitaciones pendientes de scraping.');
            scrapeandoEnCurso = false;
            return;
        }

        console.log(`🔍 Scrapeando ${pendientes.rows.length} licitaciones...`);

        for (const lic of pendientes.rows) {
            try {
                const datos = await scrapearDetalle(lic.link);

                // Clasificar con TODOS los campos ahora disponibles
                const rubro = clasificarPorDiccionario({
                    titulo: lic.titulo,
                    descripcion: lic.descripcion,
                    organismo: datos.organismo,
                    unidadEjecutora: datos.unidadEjecutora,
                    tipoLicitacion: datos.tipoLicitacion,
                    lugarApertura: datos.lugarApertura,
                    lugarEntrega: datos.lugarEntrega,
                    precioPliego: datos.precioPliego,
                    contactoNombre: datos.contactoNombre,
                    nroResolucion: datos.nroResolucion,
                    estadoResolucion: datos.estadoResolucion,
                    urlPliego: datos.urlPliego
                });

                await pool.query(`
                    UPDATE licitaciones SET
                        organismo           = $1,
                        unidad_ejecutora    = $2,
                        tipo_licitacion     = $3,
                        fecha_apertura      = $4,
                        lugar_apertura      = $5,
                        lugar_entrega       = $6,
                        precio_pliego       = $7,
                        prorrogas_hasta     = $8,
                        aclaraciones_hasta  = $9,
                        estado_resolucion   = $10,
                        nro_resolucion      = $11,
                        fecha_resolucion    = $12,
                        monto_total         = $13,
                        fondos_rotatorios   = $14,
                        contacto_nombre     = $15,
                        contacto_email      = $16,
                        contacto_telefono   = $17,
                        url_pliego          = $18,
                        rubro_ia            = $19,
                        analizado           = TRUE,
                        scrapeado           = TRUE,
                        error_scraping      = NULL,
                        fecha_scraping      = NOW()
                    WHERE id = $20
                `, [
                    datos.organismo,
                    datos.unidadEjecutora,
                    datos.tipoLicitacion,
                    datos.fechaApertura,
                    datos.lugarApertura,
                    datos.lugarEntrega,
                    datos.precioPliego,
                    datos.prorrogasHasta,
                    datos.aclaracionesHasta,
                    datos.estadoResolucion,
                    datos.nroResolucion,
                    datos.fechaResolucion,
                    datos.montoTotal,
                    datos.fondosRotatorios,
                    datos.contactoNombre,
                    datos.contactoEmail,
                    datos.contactoTelefono,
                    datos.urlPliego,
                    rubro,
                    lic.id
                ]);

                console.log(`  ✓ [${lic.id}] ${lic.titulo?.slice(0, 60)} → ${rubro}`);

                // Pausa breve para no saturar el servidor de ARCE
                await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
                // Pausa aleatoria entre 3 y 5 segundos → más humano y reduce riesgo de bloqueos por parte de ARCE

            } catch (err) {
                console.error(`  ✗ Error scrapeando id=${lic.id}: ${err.message}`);
                // Marcamos el error para no reintentar en cada ciclo hasta nuevo RSS
                await pool.query(`
                    UPDATE licitaciones SET
                        scrapeado = FALSE,
                        error_scraping = $1,
                        fecha_scraping = NOW()
                    WHERE id = $2
                `, [err.message.slice(0, 500), lic.id]);

                // En caso de error 429 / rate limit, pausa larga
                if (err.response?.status === 429 || err.response?.status === 503) {
                    console.warn('  ⚠️  Rate limit detectado. Pausando 60s...');
                    await new Promise(r => setTimeout(r, 60000));
                } else {
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
        }

        console.log(`✅ Ciclo de scraping completado.`);

    } catch (err) {
        console.error('❌ Error en procesarColaScraping:', err.message);
    } finally {
        scrapeandoEnCurso = false;
    }
}

// ============================================================
// 7. RUTAS DE LA API
// ============================================================

// GET /api/health
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', mensaje: 'API funcionando 🚀', ultimaSincronizacion });
});

// GET /api/licitaciones
// Query params: buscar, rubro, organismo, tipo, page, limit
app.get('/api/licitaciones', async (req, res) => {
    try {
        const busqueda  = req.query.buscar    || '';
        const rubro     = req.query.rubro     || '';
        const organismo = req.query.organismo || '';
        const tipo      = req.query.tipo      || '';
        const soloAbiertas = req.query.abiertas === 'true'; // filtro: apertura futura
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(100, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;

        let baseQuery = `FROM licitaciones WHERE 1=1`;
        const params = [];

        if (busqueda) {
            params.push(`%${busqueda}%`);
            baseQuery += ` AND (titulo ILIKE $${params.length} OR descripcion ILIKE $${params.length})`;
        }
        if (rubro && rubro !== 'Todos') {
            params.push(rubro);
            baseQuery += ` AND rubro_ia = $${params.length}`;
        }
        if (organismo) {
            params.push(`%${organismo}%`);
            baseQuery += ` AND organismo ILIKE $${params.length}`;
        }
        if (tipo) {
            params.push(`%${tipo}%`);
            baseQuery += ` AND tipo_licitacion ILIKE $${params.length}`;
        }
        if (soloAbiertas) {
            baseQuery += ` AND fecha_apertura > NOW()`;
        }

        const countResult = await pool.query(`SELECT COUNT(*) AS total ${baseQuery}`, params);
        const total = parseInt(countResult.rows[0].total);

        const selectSQL = `
            SELECT
                id, guid, titulo, link, fecha_publicacion,
                organismo, unidad_ejecutora, tipo_licitacion,
                fecha_apertura, lugar_apertura,
                precio_pliego, prorrogas_hasta, aclaraciones_hasta,
                estado_resolucion, monto_total,
                contacto_nombre, contacto_email, contacto_telefono,
                url_pliego, rubro_ia, scrapeado
            ${baseQuery}
            ORDER BY fecha_publicacion DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        params.push(limit, offset);

        const resultado = await pool.query(selectSQL, params);

        res.json({
            data: resultado.rows,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener datos' });
    }
});

// GET /api/licitaciones/nuevas
app.get('/api/licitaciones/nuevas', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT id, titulo, organismo, rubro_ia, link, fecha_publicacion
            FROM licitaciones
            WHERE fecha_publicacion > $1
            ORDER BY fecha_publicacion DESC
            LIMIT 20
        `, [ultimaSincronizacion]);

        res.json({
            nuevas: ultimasNuevasLicitaciones,
            datos: resultado.rows,
            ultimaSincronizacion
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener nuevas licitaciones' });
    }
});


// GET /api/licitaciones/:id
app.get('/api/licitaciones/:id', async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM licitaciones WHERE id = $1',
            [req.params.id]
        );
        if (resultado.rows.length === 0) return res.status(404).json({ error: 'No encontrada' });
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener licitación' });
    }
});



// GET /api/rubros
app.get('/api/rubros', async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT DISTINCT rubro_ia FROM licitaciones WHERE rubro_ia IS NOT NULL ORDER BY rubro_ia`
        );
        res.json(resultado.rows.map(r => r.rubro_ia));
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener rubros' });
    }
});

// GET /api/organismos
app.get('/api/organismos', async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT DISTINCT organismo FROM licitaciones WHERE organismo IS NOT NULL ORDER BY organismo`
        );
        res.json(resultado.rows.map(r => r.organismo));
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener organismos' });
    }
});

// GET /api/estadisticas
app.get('/api/estadisticas', async (req, res) => {
    try {
        const [total, porRubro, porTipo, pendientesScraping] = await Promise.all([
            pool.query(`SELECT COUNT(*) AS total FROM licitaciones`),
            pool.query(`
                SELECT rubro_ia, COUNT(*) AS cantidad
                FROM licitaciones
                WHERE rubro_ia IS NOT NULL
                GROUP BY rubro_ia
                ORDER BY cantidad DESC
            `),
            pool.query(`
                SELECT tipo_licitacion, COUNT(*) AS cantidad
                FROM licitaciones
                WHERE tipo_licitacion IS NOT NULL
                GROUP BY tipo_licitacion
                ORDER BY cantidad DESC
            `),
            pool.query(`SELECT COUNT(*) AS pendientes FROM licitaciones WHERE scrapeado = FALSE`)
        ]);

        res.json({
            total: parseInt(total.rows[0].total),
            porRubro: porRubro.rows,
            porTipo: porTipo.rows,
            pendientesScraping: parseInt(pendientesScraping.rows[0].pendientes),
            ultimaSincronizacion
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// POST /api/sincronizar  — Fuerza RSS + dispara scraping inmediatamente
app.post('/api/sincronizar', async (req, res) => {
    try {
        const resultado = await procesarRSS();
        // Disparar scraping en background sin bloquear la respuesta
        procesarColaScraping(10).catch(e => console.error('Error scraping post-sync:', e.message));
        res.json({ success: true, mensaje: 'Sincronización iniciada', ...resultado });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al sincronizar' });
    }
});

// POST /api/scraping/forzar  — Fuerza un ciclo de scraping manualmente
app.post('/api/scraping/forzar', async (req, res) => {
    if (scrapeandoEnCurso) {
        return res.json({ success: false, mensaje: 'Ya hay un scraping en curso' });
    }
    procesarColaScraping(20).catch(e => console.error('Error scraping manual:', e.message));
    res.json({ success: true, mensaje: 'Scraping iniciado en background' });
});

// GET /api/scraping/estado  — Cuántas quedan por scrapear
app.get('/api/scraping/estado', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE scrapeado = FALSE) AS pendientes,
                COUNT(*) FILTER (WHERE scrapeado = TRUE)  AS completadas,
                COUNT(*) AS total
            FROM licitaciones
        `);
        res.json({ ...r.rows[0], enCurso: scrapeandoEnCurso });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener estado del scraping' });
    }
});

// ============================================================
// 8. ARRANQUE
// ============================================================

const INTERVALO_RSS      = 5  * 60 * 1000; // 5 minutos
const INTERVALO_SCRAPING = 30 * 60 * 1000; // 30 minutos (respeta a ARCE)

async function arrancar() {
    try {
        await inicializarDB();

        // Carga inicial
        await procesarRSS();

        // Primer ciclo de scraping arranca 5s después para no bloquear
        setTimeout(() => {
            procesarColaScraping(10).catch(e => console.error(e.message));
        }, 5000);

        // RSS automático cada 5 minutos
        setInterval(() => {
            console.log('⏰ Sincronización RSS automática...');
            procesarRSS().catch(e => console.error('Error RSS automático:', e.message));
        }, INTERVALO_RSS);

        // Scraping automático cada 10 minutos
        setInterval(() => {
            console.log('⏰ Ciclo de scraping automático...');
            procesarColaScraping(10).catch(e => console.error('Error scraping automático:', e.message));
        }, INTERVALO_SCRAPING);

        app.listen(PORT, () => {
            console.log(`🚀 Backend en http://localhost:${PORT}`);
            console.log(`🔧 CORS habilitado para: ${whitelist.join(', ')}`);
            console.log(`📡 RSS cada ${INTERVALO_RSS / 60000} min | Scraping cada ${INTERVALO_SCRAPING / 60000} min`);
        });

    } catch (err) {
        console.error('💥 Error al arrancar:', err);
        process.exit(1);
    }
}

arrancar();