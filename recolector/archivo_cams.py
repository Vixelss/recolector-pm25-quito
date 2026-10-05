"""Descarga única de corridas pasadas de CAMS global (H31, D30).

Open-Meteo guarda en su Single Runs API las corridas de las 00 UTC de CAMS
global desde el 02/04/2026 (con algunos días faltantes). Este script las
copia a la tabla pronostico_cams_archivo para comparar CAMS con la REMMAQ
antes del inicio de la recolección. No forma parte de la ejecución horaria.

Uso:
    python -m recolector.archivo_cams --desde 2026-04-02 --hasta 2026-09-29

Se puede repetir sin duplicar datos (ON CONFLICT DO NOTHING).
"""

import argparse
import logging
import os
import sys
from datetime import date, datetime, timedelta, timezone

from dotenv import load_dotenv

from . import config, db
from .red import ErrorFuente, obtener_json, registrar_secreto

URL_CORRIDAS = "https://single-runs-api.open-meteo.com/v1/forecast"

log = logging.getLogger("archivo_cams")


def descargar_corrida(dia: date, descargado_en: datetime) -> list[dict] | None:
    """Filas de la corrida de las 00 UTC de ese día; None si no está archivada."""
    corrida = datetime(dia.year, dia.month, dia.day, tzinfo=timezone.utc)
    params = {
        "latitude": ",".join(str(e.latitud) for e in config.ESTACIONES),
        "longitude": ",".join(str(e.longitud) for e in config.ESTACIONES),
        "hourly": "pm2_5",
        "models": "cams_global",
        "run": corrida.strftime("%Y-%m-%dT%H:%M"),
    }
    try:
        ubicaciones = obtener_json(URL_CORRIDAS, params, f"CAMS corrida {dia}")
    except ErrorFuente as e:
        # La API responde 400 "The requested model run is not available".
        if "not available" in str(e):
            return None
        raise
    if isinstance(ubicaciones, dict):
        ubicaciones = [ubicaciones]

    filas = []
    for est, ub in zip(config.ESTACIONES, ubicaciones):
        zona = timezone(timedelta(seconds=ub["utc_offset_seconds"]))
        for t, valor in zip(ub["hourly"]["time"], ub["hourly"]["pm2_5"]):
            if valor is None:
                continue
            filas.append({
                "estacion_id": est.id_aqicn,
                "corrida": corrida,
                "hora_objetivo": datetime.fromisoformat(t).replace(tzinfo=zona),
                "pm2_5_ugm3": valor,
                "lat_cuadricula": ub.get("latitude"),
                "lon_cuadricula": ub.get("longitude"),
                "descargado_en": descargado_en,
            })
    return filas


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(message)s",
                        datefmt="%Y-%m-%d %H:%M:%S", stream=sys.stdout)
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--desde", type=date.fromisoformat, required=True)
    parser.add_argument("--hasta", type=date.fromisoformat, required=True)
    args = parser.parse_args()

    load_dotenv()
    url = os.environ["DATABASE_URL"]
    registrar_secreto(url)
    con = db.conectar(url)
    descargado_en = datetime.now(timezone.utc)

    faltantes, total = [], 0
    dia = args.desde
    while dia <= args.hasta:
        filas = descargar_corrida(dia, descargado_en)
        if filas is None:
            faltantes.append(dia.isoformat())
            log.warning("%s: corrida no disponible", dia)
        else:
            nuevas = db.insertar_cams_archivo(con, filas)
            total += nuevas
            log.info("%s: %d filas (%d nuevas)", dia, len(filas), nuevas)
        dia += timedelta(days=1)

    log.info("Fin: %d filas nuevas | %d corridas no disponibles: %s",
             total, len(faltantes), ", ".join(faltantes) or "ninguna")
    return 0


if __name__ == "__main__":
    sys.exit(main())
