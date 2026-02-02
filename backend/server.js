// BACKEND API - Solo datos JSON
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Conexión a PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Diccionario de rubros
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

// Función de clasificación por diccionario
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

  if (Object.keys(puntuaciones).length === 0) return 'Otros';
  return Object.entries(puntuaciones).sort((a, b) => b[1] - a[1])[0][0];
}

// RUTAS API
// 1. Obtener licitaciones con búsqueda
app.get('/api/licitaciones', async (req, res) => {
  try {
    const busqueda = req.query.buscar || '';
    const rubro = req.query.rubro || '';
    
    let querySQL = `
      SELECT id, titulo, organismo, rubro_ia, link, fecha_publicacion 
      FROM licitaciones 
      WHERE 1=1
    `;
    const params = [];

    if (busqueda) {
      querySQL += ` AND titulo ILIKE $${params.length + 1}`;
      params.push(`%${busqueda}%`);
    }

    if (rubro) {
      querySQL += ` AND rubro_ia = $${params.length + 1}`;
      params.push(rubro);
    }

    querySQL += ` ORDER BY fecha_publicacion DESC LIMIT 100`;
    
    const resultado = await pool.query(querySQL, params);
    res.json({
      success: true,
      data: resultado.rows,
      total: resultado.rows.length
    });
  } catch (error) {
    console.error('Error en /api/licitaciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener licitaciones'
    });
  }
});

// 2. Obtener licitación por ID
app.get('/api/licitaciones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      'SELECT * FROM licitaciones WHERE id = $1',
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Licitación no encontrada'
      });
    }

    res.json({
      success: true,
      data: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error en /api/licitaciones/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener licitación'
    });
  }
});

// 3. Obtener rubros disponibles
app.get('/api/rubros', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT DISTINCT rubro_ia FROM licitaciones WHERE rubro_ia IS NOT NULL ORDER BY rubro_ia'
    );

    const rubros = resultado.rows.map(row => row.rubro_ia);
    res.json({
      success: true,
      data: rubros
    });
  } catch (error) {
    console.error('Error en /api/rubros:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener rubros'
    });
  }
});

// 4. Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Backend API listo en http://localhost:${port}`);
  console.log(`📊 Endpoints disponibles:`);
  console.log(`   GET /api/licitaciones - Listar licitaciones`);
  console.log(`   GET /api/licitaciones/:id - Obtener licitación`);
  console.log(`   GET /api/rubros - Obtener rubros`);
  console.log(`   GET /api/health - Health check`);
});

export default app;
