
import 'dotenv/config';
import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = 3001;

const pool = new Pool({
    user: 'saul_dev',
    host: '127.0.0.1',
    database: 'bot_compras',
    password: '12345',
    port: 5432,
});

app.get('/ver-tabla', async (req, res) => {
    try {
        // 1. Consultamos los datos
        const resultado = await pool.query('SELECT id, titulo, fecha_publicacion, link FROM licitaciones ORDER BY id ASC');

        // 2. Construimos el HTML
        let html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Vista de Licitaciones</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body class="container mt-5">
                <div class="card shadow">
                    <div class="card-header bg-primary text-white">
                        <h3 class="mb-0">📋 Licitaciones</h3>
                    </div>
                    <div class="card-body">
                        <table class="table table-hover">
                            <thead class="table-light">
                                <tr>
                                    <th>ID</th>
                                    <th>Título</th>
                                    <th>Fecha de Creación</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        // 3. Iteramos sobre las filas para llenar la tabla
        resultado.rows.forEach(fila => {
            html += `
                <tr>
                    <td>${fila.id}</td>
                    <td>${fila.titulo}</td>
                    <td>${new Date(fila.fecha_publicacion).toLocaleString()}</td>
                    
                    <td><a href="${fila.link}" target="_blank" class="btn btn-sm btn-outline-primary">Ver Pliego</a></td>

                </tr>
            `;
            console.log(fila);
        });

        html += `
                            </tbody>
                        </table>
                    </div>
                    <div class="card-footer text-muted text-end">
                        Total en esta vista: ${resultado.rowCount}
                    </div>
                </div>
            </body>
            </html>
        `;

        res.send(html);

    } catch (err) {
        console.error(err);
        res.status(500).send("Error al obtener los datos de la base de datos.");
    }
});

app.listen(port, () => {
    console.log(`🚀 Tabla disponible en http://localhost:${port}/ver-tabla`);
});