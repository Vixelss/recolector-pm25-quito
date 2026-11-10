# recolector-pm25-quito

Sistema de pronóstico horario de PM2.5 en Quito, parte de una tesis de titulación: recolecta cada hora las
mediciones y pronósticos públicos, pronostica las próximas 24 horas con un modelo de aprendizaje automático y
publica el resultado en una página web.

**Página:** https://vixelss.github.io/recolector-pm25-quito/

Proyecto académico: no sustituye la información oficial de la Secretaría de Ambiente del Distrito Metropolitano de Quito.

## Arquitectura

Inferencia por lotes con sitio estático, en cuatro capas. Cada hora, un mismo flujo de GitHub Actions ejecuta:

| Capa | Qué hace | Dónde |
|---|---|---|
| 1. Ingesta | Descarga AQICN, Open-Meteo y CAMS y los guarda en Neon (PostgreSQL) | [`recolector/`](recolector/) |
| 2. Inferencia | Convierte el AQI a µg/m³, limpia, arma las variables y aplica los 24 modelos (uno por horizonte) | [`pronostico/`](pronostico/) → tabla `pronostico_modelo` |
| 3. Publicación | Calcula el desempeño (frente a persistencia y CAMS) y genera `datos.json` | [`pronostico/exportar.py`](pronostico/exportar.py) |
| 4. Presentación | Página estática (React + TypeScript + Vite) que lee `datos.json` | [`web/`](web/) → GitHub Pages |

La página no se conecta a la base de datos: solo lee el archivo generado en cada ejecución.

## Datos que se guardan

| Fuente | Qué se guarda | Tabla |
|---|---|---|
| [AQICN](https://aqicn.org/) | Última medición de las 8 estaciones de la REMMAQ (contaminantes en escala AQI de la EPA y meteorología) | `mediciones_aqicn` |
| [Open-Meteo](https://open-meteo.com/) | Pronóstico meteorológico de 48 h por estación (modelo `best_match`) | `pronostico_clima` |
| Open-Meteo Air Quality (CAMS global) | Pronóstico de PM2.5 de 48 h por estación, en µg/m³ | `pronostico_cams` |
| Modelo propio (XGBoost) | Pronóstico de PM2.5 de 24 h para Belisario, Carapungo y Tumbaco, con banda de incertidumbre, categoría del IQCA y avisos | `pronostico_modelo` |
| — | Registro de cada ejecución del recolector: estado, filas nuevas, errores y avisos | `ejecuciones` |
| Open-Meteo Single Runs (CAMS global) | Corridas **pasadas** de las 00 UTC (desde el 02/04/2026), descargadas una sola vez con `python -m recolector.archivo_cams` | `pronostico_cams_archivo` |

Los pronósticos de Open-Meteo y CAMS se guardan en 8 emisiones al día (00, 03, …, 21 hora de Ecuador); el del modelo propio, cada hora.

## El modelo

- XGBoost, versión A: PM2.5 propio y de las estaciones vecinas publicado hasta dos horas antes de la emisión, calendario de la hora objetivo y una variable del cambio de nivel de Tumbaco. Un modelo por horizonte (1 a 24 h).
- Entrenado con el registro validado de la REMMAQ de 2018 al 31/08/2026. Los archivos están en [`pronostico/modelo/`](pronostico/modelo/): los 24 modelos (`.ubj`), `metadatos.json` (variables, umbrales, feriados, limpieza) y la tabla de conversión del AQI.
- El servicio reproduce exactamente las predicciones de la evaluación del análisis ([`tests/test_reproducibilidad.py`](tests/test_reproducibilidad.py); necesita los archivos del análisis, que no se publican).

## Cómo funciona

- **Disparador:** [cron-job.org](https://cron-job.org/) llama cada hora, en el minuto 7, a la API de GitHub y lanza el flujo [`.github/workflows/recolector.yml`](.github/workflows/recolector.yml) (`workflow_dispatch`). No se usa el `schedule` de GitHub porque se saltaba horas.
- **Flujo:** trabajo `recolectar` (recolector y, en un paso aparte, pronóstico) y trabajo `publicar` (`datos.json`, compilación y GitHub Pages). Si el pronóstico o la publicación fallan, la recolección de esa hora queda guardada.
- **Esquema de la base:** [`sql/esquema.sql`](sql/esquema.sql).

## Ejecutar en local

Requiere Python 3.13 y, para la página, Node 22.

```bash
python -m venv .venv
.venv/Scripts/activate            # Windows (en Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env              # completar WAQI_TOKEN y DATABASE_URL
python -m recolector.main         # recolectar
python -m pronostico.main --seco  # pronosticar sin guardar
python -m pronostico.exportar     # generar web/public/datos.json

cd web
npm install
npm run dev                       # página en http://localhost:5173/recolector-pm25-quito/
npm run build && npm run revisar  # compilar y revisar con un navegador automático (Playwright)
```

- `python -m pytest tests` ejecuta las pruebas.
- `--forzar-pronosticos` (recolector) guarda los pronósticos de Open-Meteo aunque no toque emisión. **Solo para pruebas.**
- Para lanzar el flujo en GitHub a mano: `gh workflow run recolector.yml`.

## Secretos

`WAQI_TOKEN` y `DATABASE_URL` van en `.env` (no se sube al repositorio) y en los *secrets* del repositorio de GitHub. El token de GitHub que usa cron-job.org solo se guarda allí y hay que renovarlo antes de que venza.

## Atribución y uso de los datos

Datos de calidad del aire:

- *Metropolitan Air Monitoring Network of Quito managed by Secretaria de Ambiente DMQ*
- *World Air Quality Index Project* (https://aqicn.org/)

Según los términos de uso de AQICN, **los datos archivados no se redistribuyen**: se guardan solo para uso interno de esta tesis. La página muestra solo las mediciones de los últimos 7 días, no ofrece descargas y su `datos.json` no se guarda en el historial de git.

Los pronósticos son de [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Los de calidad del aire provienen de Copernicus Atmosphere Monitoring Service (CAMS). Cartografía © [OpenStreetMap](https://www.openstreetmap.org/copyright).
