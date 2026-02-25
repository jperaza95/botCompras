-- Ejecutar esto si ya tenías la tabla "licitaciones" creada previamente
-- y no querés perder los datos existentes.

ALTER TABLE licitaciones
    ADD COLUMN IF NOT EXISTS organismo           TEXT,
    ADD COLUMN IF NOT EXISTS unidad_ejecutora    TEXT,
    ADD COLUMN IF NOT EXISTS tipo_licitacion     TEXT,
    ADD COLUMN IF NOT EXISTS fecha_apertura      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lugar_apertura      TEXT,
    ADD COLUMN IF NOT EXISTS lugar_entrega       TEXT,
    ADD COLUMN IF NOT EXISTS precio_pliego       TEXT,
    ADD COLUMN IF NOT EXISTS prorrogas_hasta     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS aclaraciones_hasta  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS estado_resolucion   TEXT,
    ADD COLUMN IF NOT EXISTS nro_resolucion      TEXT,
    ADD COLUMN IF NOT EXISTS fecha_resolucion    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS monto_total         NUMERIC,
    ADD COLUMN IF NOT EXISTS fondos_rotatorios   BOOLEAN,
    ADD COLUMN IF NOT EXISTS contacto_nombre     TEXT,
    ADD COLUMN IF NOT EXISTS contacto_email      TEXT,
    ADD COLUMN IF NOT EXISTS contacto_telefono   TEXT,
    ADD COLUMN IF NOT EXISTS url_pliego          TEXT,
    ADD COLUMN IF NOT EXISTS error_scraping      TEXT,
    ADD COLUMN IF NOT EXISTS fecha_scraping      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at          TIMESTAMPTZ DEFAULT NOW();

-- Asegurarse que la columna scrapeado existe con valor por defecto FALSE
ALTER TABLE licitaciones
    ADD COLUMN IF NOT EXISTS scrapeado BOOLEAN DEFAULT FALSE;

-- Marcar los que ya tienen organismo como scrapeados (si hubiera datos previos)
UPDATE licitaciones SET scrapeado = FALSE WHERE scrapeado IS NULL;

-- También resetear analizado para que se reclasifiquen con más datos
-- (opcional, comentar si no querés perder clasificaciones existentes)
-- UPDATE licitaciones SET analizado = FALSE;
