-- =====================================================================
-- Esquema de la base de datos del recolector de PM2.5 (Neon / PostgreSQL)
--
-- Reglas generales:
--   * Todas las fechas son TIMESTAMPTZ (guardan el instante exacto; Ecuador
--     es UTC-5 sin horario de verano).
--   * Las claves primarias evitan duplicados; el recolector inserta con
--     ON CONFLICT DO NOTHING, así que repetir una ejecución no duplica datos.
--   * Los nombres de columna llevan la unidad cuando aplica (_kmh, _hpa...).
--   * Se puede ejecutar varias veces sin error (IF NOT EXISTS).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Mediciones de AQICN (una fila por estación y hora medida)
--
-- OJO: los contaminantes (pm25, pm10, no2, co, so2, o3) vienen en la
-- ESCALA AQI de la EPA de EE. UU., NO en µg/m³. Se guardan tal cual; la
-- conversión se hace después, fuera del recolector.
-- La meteorología de AQICN (t, h, p, w, wd, wg, dew, r) proviene de una red
-- ciudadana, no es oficial, y la presión está ajustada al nivel del mar.
-- Cualquier campo puede faltar según la estación, por eso todos admiten NULL.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mediciones_aqicn (
    estacion_id            INTEGER          NOT NULL,  -- ID de AQICN (ej. 6941)
    estacion               TEXT             NOT NULL,  -- nombre corto (ej. 'Belisario')
    medido_en              TIMESTAMPTZ      NOT NULL,  -- de data.time.iso (NUNCA data.time.v)
    aqi_general            TEXT,                       -- data.aqi tal como viene (número, texto o '-')
    aqi_num                DOUBLE PRECISION,           -- data.aqi convertido a número; NULL si no se pudo
    contaminante_dominante TEXT,                       -- data.dominentpol (ej. 'pm25', 'o3')
    pm25  DOUBLE PRECISION,
    pm10  DOUBLE PRECISION,
    no2   DOUBLE PRECISION,
    co    DOUBLE PRECISION,
    so2   DOUBLE PRECISION,
    o3    DOUBLE PRECISION,
    t     DOUBLE PRECISION,   -- temperatura (°C)
    h     DOUBLE PRECISION,   -- humedad relativa (%)
    p     DOUBLE PRECISION,   -- presión a nivel del mar (hPa), no comparable con la REMMAQ
    w     DOUBLE PRECISION,   -- velocidad del viento
    wd    DOUBLE PRECISION,   -- dirección del viento (grados)
    wg    DOUBLE PRECISION,   -- ráfaga de viento (no apareció en las pruebas)
    dew   DOUBLE PRECISION,   -- punto de rocío
    r     DOUBLE PRECISION,   -- campo 'r' de AQICN (probablemente lluvia); no estaba documentado
    consultado_en          TIMESTAMPTZ      NOT NULL,  -- cuándo hicimos la consulta
    respuesta_cruda        JSONB            NOT NULL,  -- respuesta completa, por si se necesita revisar algo
    PRIMARY KEY (estacion_id, medido_en)
);


-- ---------------------------------------------------------------------
-- Pronóstico meteorológico de Open-Meteo
-- Una fila por estación, emisión y hora objetivo.
--   hora_emision  = hora de Ecuador en punto en que tocaba emitir (00, 03,
--                   ..., 21). Identifica la emisión y forma parte de la clave:
--                   si el recolector corre dos veces en la misma hora, se
--                   conserva la primera consulta y la segunda se descarta.
--   emitido_en    = momento real de NUESTRA consulta (igual para todas las
--                   filas de una ejecución). La API no informa la hora real
--                   de la corrida del modelo.
--   hora_objetivo = hora para la que es el pronóstico.
-- Unidades originales de Open-Meteo (el viento en km/h; la REMMAQ usa m/s).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pronostico_clima (
    estacion_id                  INTEGER     NOT NULL,
    hora_emision                 TIMESTAMPTZ NOT NULL,
    emitido_en                   TIMESTAMPTZ NOT NULL,
    hora_objetivo                TIMESTAMPTZ NOT NULL,
    temperatura_2m_c             DOUBLE PRECISION,  -- temperature_2m (°C)
    humedad_relativa_2m_pct      DOUBLE PRECISION,  -- relative_humidity_2m (%)
    viento_10m_kmh               DOUBLE PRECISION,  -- wind_speed_10m (km/h)
    direccion_viento_10m_grados  DOUBLE PRECISION,  -- wind_direction_10m (°)
    precipitacion_mm             DOUBLE PRECISION,  -- precipitation (mm, acumulado de la hora)
    presion_superficie_hpa       DOUBLE PRECISION,  -- surface_pressure (hPa, a la altura de Quito ~730)
    radiacion_onda_corta_wm2     DOUBLE PRECISION,  -- shortwave_radiation (W/m²)
    lat_cuadricula               DOUBLE PRECISION,  -- latitud devuelta por la API (punto de su malla)
    lon_cuadricula               DOUBLE PRECISION,  -- longitud devuelta por la API
    elevacion_m                  DOUBLE PRECISION,  -- elevación usada por la API (m)
    PRIMARY KEY (estacion_id, hora_emision, hora_objetivo)
);


-- ---------------------------------------------------------------------
-- Pronóstico de PM2.5 de CAMS (vía Open-Meteo Air Quality)
-- Valores en µg/m³ (a diferencia de AQICN).
-- CAMS global tiene celdas de ~0,4° (~45 km): en las pruebas solo hubo 2
-- series distintas para las 8 estaciones (norte y sur). Las coordenadas
-- devueltas por la API vienen redondeadas y no identifican la celda real.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pronostico_cams (
    estacion_id     INTEGER     NOT NULL,
    hora_emision    TIMESTAMPTZ NOT NULL,  -- ver explicación en pronostico_clima
    emitido_en      TIMESTAMPTZ NOT NULL,
    hora_objetivo   TIMESTAMPTZ NOT NULL,
    pm2_5_ugm3      DOUBLE PRECISION,  -- puede ser NULL al final del horizonte
    lat_cuadricula  DOUBLE PRECISION,
    lon_cuadricula  DOUBLE PRECISION,
    PRIMARY KEY (estacion_id, hora_emision, hora_objetivo)
);


-- ---------------------------------------------------------------------
-- Registro de cada ejecución del recolector
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ejecuciones (
    id                     BIGSERIAL   PRIMARY KEY,
    iniciado_en            TIMESTAMPTZ NOT NULL,
    finalizado_en          TIMESTAMPTZ,
    incluye_pronosticos    BOOLEAN     NOT NULL,  -- TRUE en las horas 00, 03, ..., 21 de Ecuador
    estado                 TEXT        NOT NULL CHECK (estado IN ('ok', 'parcial', 'error')),
    filas_mediciones       INTEGER     NOT NULL DEFAULT 0,  -- filas NUEVAS (sin contar duplicados)
    filas_clima            INTEGER     NOT NULL DEFAULT 0,
    filas_cams             INTEGER     NOT NULL DEFAULT 0,
    errores                JSONB,      -- lista de errores por estación/fuente (sin secretos)
    avisos                 JSONB,      -- situaciones no fatales (ej. El Camal con dato antiguo)
    origen                 TEXT        -- 'github-actions' o 'local'
);
