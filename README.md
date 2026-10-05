# recolector-pm25-quito

Recolector de datos de calidad del aire y pronósticos para la tesis de pronóstico de PM2.5 en Quito.

Cada hora guarda en una base PostgreSQL (Neon):

| Fuente | Qué se guarda | Tabla |
|---|---|---|
| [AQICN](https://aqicn.org/) | Última medición de las 8 estaciones de la REMMAQ (contaminantes en escala AQI de la EPA y meteorología) | `mediciones_aqicn` |
| [Open-Meteo](https://open-meteo.com/) | Pronóstico meteorológico de 48 h por estación (modelo `best_match`) | `pronostico_clima` |
| Open-Meteo Air Quality (CAMS global) | Pronóstico de PM2.5 de 48 h por estación, en µg/m³ | `pronostico_cams` |
| — | Registro de cada ejecución: estado, filas nuevas, errores y avisos | `ejecuciones` |
| Open-Meteo Single Runs (CAMS global) | Corridas **pasadas** de las 00 UTC (desde el 02/04/2026), descargadas una sola vez con `python -m recolector.archivo_cams` | `pronostico_cams_archivo` |

Los pronósticos se guardan en 8 emisiones al día (00, 03, …, 21 hora de Ecuador). Si una emisión se retrasa, se recupera dentro de su bloque de 3 h.

## Cómo funciona

- **Disparador:** [cron-job.org](https://cron-job.org/) llama cada hora, en el minuto 7, a la API de GitHub y lanza el flujo [`.github/workflows/recolector.yml`](.github/workflows/recolector.yml) (`workflow_dispatch`). No se usa el `schedule` de GitHub (ver D27 y D28).
- **Código:** carpeta [`recolector/`](recolector/).
  - `config.py`: estaciones y parámetros.
  - `red.py`: solicitudes con reintentos y ocultamiento de secretos.
  - `aqicn.py` y `open_meteo.py`: las fuentes.
  - `db.py`: inserción con `ON CONFLICT DO NOTHING`.
  - `main.py`: la ejecución completa.
- **Esquema de la base:** [`sql/esquema.sql`](sql/esquema.sql).
- **Bitácora de decisiones y hallazgos:** [`DECISIONES.md`](DECISIONES.md). **Contexto y requisitos iniciales:** [`CONTEXTO_RECOLECTOR.md`](CONTEXTO_RECOLECTOR.md).

## Ejecutar en local

Requiere Python 3.13.

```bash
python -m venv .venv
.venv/Scripts/activate            # Windows (en Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env              # completar WAQI_TOKEN y DATABASE_URL
python -m recolector.main
```

- `--forzar-pronosticos` guarda los pronósticos aunque no toque emisión. **Solo para pruebas:** la emisión queda con la hora actual y en el análisis se descarta, filtrando `hora_emision` por 00, 03, …, 21.
- Para lanzarlo en GitHub a mano: `gh workflow run recolector.yml`.

## Secretos

`WAQI_TOKEN` y `DATABASE_URL` van en `.env` (no se sube al repositorio) y en los *secrets* del repositorio de GitHub. El token de GitHub que usa cron-job.org solo se guarda allí, y hay que renovarlo antes de que venza (ver D27).

## Atribución y uso de los datos

Datos de calidad del aire:

- *Metropolitan Air Monitoring Network of Quito managed by Secretaria de Ambiente DMQ*
- *World Air Quality Index Project* (https://aqicn.org/)

Según los términos de uso de AQICN, **los datos archivados no se redistribuyen**: se guardan solo para uso interno de esta tesis.

Los pronósticos son de [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Los de calidad del aire provienen de Copernicus Atmosphere Monitoring Service (CAMS).
