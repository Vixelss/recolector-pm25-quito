"""Punto de entrada del recolector. Uso:

    python -m recolector.main                       # ejecución normal (cada hora)
    python -m recolector.main --forzar-pronosticos  # pruebas: pronósticos a cualquier hora

Cada ejecución (D2):
  1. Siempre: guarda la última medición de AQICN de las 8 estaciones.
  2. Guarda también los pronósticos de clima y de CAMS si todavía falta la
     emisión del bloque de 3 horas actual (00, 03, ..., 21 de Ecuador). Así,
     una ejecución atrasada (ej. 04:36) recupera la emisión de las 03:00 (D26).
  3. Registra la ejecución en la tabla `ejecuciones`.
"""

import argparse
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from dotenv import load_dotenv

from . import aqicn, config, db, open_meteo
from .red import ErrorFuente, ocultar, registrar_secreto

log = logging.getLogger("recolector")


def configurar_registro() -> None:
    # UTF-8 para que la consola de Windows no falle con "µ" o "í" (hallazgo H17).
    sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
    )


def recolectar_mediciones(token: str, ahora: datetime, errores: list, avisos: list) -> list[dict]:
    """Consulta las 8 estaciones en paralelo; una estación que falla no detiene a las demás."""
    def consultar(est):
        try:
            return aqicn.consultar_estacion(est, token, ahora)
        except ErrorFuente as e:
            return e

    # 8 hilos: la ejecución tarda lo que tarde la estación más lenta, no la suma.
    with ThreadPoolExecutor(max_workers=len(config.ESTACIONES)) as ejecutor:
        resultados = list(ejecutor.map(consultar, config.ESTACIONES))

    filas = []
    for est, res in zip(config.ESTACIONES, resultados):
        if isinstance(res, ErrorFuente):
            errores.append(str(res))
            log.error("%s", res)
            continue
        antiguedad = ahora - res["medido_en"]
        if antiguedad > config.ANTIGUEDAD_MAXIMA_MEDICION:
            # Caso de El Camal: la API responde "ok" pero con un dato viejo (H5).
            aviso = (f"AQICN {est.nombre}: dato antiguo, medido el "
                     f"{res['medido_en'].astimezone(config.ZONA_ECUADOR):%d/%m/%Y %H:%M}")
            avisos.append(aviso)
            log.warning("%s", aviso)
        else:
            log.info("AQICN %-11s medido %s  aqi=%s pm25=%s",
                     est.nombre, res["medido_en"].astimezone(config.ZONA_ECUADOR).strftime("%H:%M"),
                     res["aqi_general"], res["pm25"])
        filas.append(res)
    return filas


def recolectar_pronostico(funcion, nombre: str, hora_emision: datetime, emitido_en: datetime,
                          errores: list) -> list[dict]:
    """Ejecuta una consulta de pronóstico; si falla, registra el error y devuelve []."""
    try:
        filas = funcion(hora_emision, emitido_en)
        log.info("%s: %d filas (%d estaciones)", nombre, len(filas), len(config.ESTACIONES))
        return filas
    except (ErrorFuente, KeyError, TypeError, ValueError) as e:
        # KeyError/TypeError/ValueError: la respuesta llegó con un formato inesperado.
        mensaje = ocultar(f"{nombre}: {type(e).__name__}: {e}")[:500]
        errores.append(mensaje)
        log.error("%s", mensaje)
        return []


def main() -> int:
    configurar_registro()
    parser = argparse.ArgumentParser(description="Recolector de PM2.5 para Quito")
    parser.add_argument("--forzar-pronosticos", action="store_true",
                        help="guardar pronósticos con la hora actual como emisión (solo pruebas)")
    args = parser.parse_args()

    # En local lee el archivo .env; en GitHub Actions las variables ya existen
    # (vienen de los Secrets) y load_dotenv no las sobrescribe.
    load_dotenv()
    token = os.environ.get("WAQI_TOKEN", "")
    url_bd = os.environ.get("DATABASE_URL", "")
    if not token or not url_bd:
        log.error("Faltan variables de entorno: WAQI_TOKEN y/o DATABASE_URL")
        return 1
    registrar_secreto(token)
    registrar_secreto(url_bd)

    en_github = os.environ.get("GITHUB_ACTIONS") == "true"
    origen = f"github-actions:{os.environ.get('GITHUB_RUN_ID', '')}" if en_github else "local"

    # Un único instante de referencia: sirve como consultado_en y emitido_en (D12).
    iniciado_en = datetime.now(timezone.utc)
    hora_ecuador = iniciado_en.astimezone(config.ZONA_ECUADOR)
    if args.forzar_pronosticos:
        # Pruebas: emisión identificada por la hora en punto actual (D21).
        hora_emision = hora_ecuador.replace(minute=0, second=0, microsecond=0)
    else:
        # Inicio del bloque de 3 horas actual (ej. 04:36 -> 03:00). Si el
        # recolector corre dos veces en el mismo bloque, la segunda ejecución
        # ve la emisión ya guardada y no consulta de nuevo (D22, D26).
        hora_bloque = max(h for h in config.HORAS_PRONOSTICO if h <= hora_ecuador.hour)
        hora_emision = hora_ecuador.replace(hour=hora_bloque, minute=0, second=0, microsecond=0)

    # Qué pronósticos faltan en esta emisión. Se revisa cada tabla por separado:
    # si antes falló solo CAMS, esta ejecución reintenta solo CAMS.
    try:
        with db.conectar(url_bd) as con:
            falta_clima = args.forzar_pronosticos or not db.emision_guardada(
                con, "pronostico_clima", hora_emision)
            falta_cams = args.forzar_pronosticos or not db.emision_guardada(
                con, "pronostico_cams", hora_emision)
    except Exception as e:
        log.error("No se pudo usar la base de datos: %s", ocultar(f"{type(e).__name__}: {e}"))
        return 1
    incluye_pronosticos = falta_clima or falta_cams
    log.info("Inicio %s (hora Ecuador) | origen=%s | emisión %s | pronósticos=%s",
             hora_ecuador.strftime("%Y-%m-%d %H:%M:%S"), origen, hora_emision.strftime("%H:%M"),
             ("forzado" if args.forzar_pronosticos
              else "faltan " + " y ".join(n for n, f in [("clima", falta_clima), ("CAMS", falta_cams)] if f)
              if incluye_pronosticos else "ya guardados"))

    errores: list[str] = []
    avisos: list[str] = []

    # 1. Consultar las fuentes (antes de abrir la base de datos).
    mediciones = recolectar_mediciones(token, iniciado_en, errores, avisos)
    clima, cams = [], []
    if falta_clima:
        clima = recolectar_pronostico(open_meteo.pronostico_clima, "Open-Meteo clima",
                                      hora_emision, iniciado_en, errores)
    if falta_cams:
        cams = recolectar_pronostico(open_meteo.pronostico_cams, "Open-Meteo CAMS",
                                     hora_emision, iniciado_en, errores)

    # 2. Guardar en Neon.
    filas = {"mediciones": 0, "clima": 0, "cams": 0}
    try:
        with db.conectar(url_bd) as con:
            for clave, funcion, datos in [("mediciones", db.insertar_mediciones, mediciones),
                                          ("clima", db.insertar_clima, clima),
                                          ("cams", db.insertar_cams, cams)]:
                try:
                    filas[clave] = funcion(con, datos)
                except Exception as e:
                    mensaje = ocultar(f"BD {clave}: {type(e).__name__}: {e}")[:500]
                    errores.append(mensaje)
                    log.error("%s", mensaje)

            # 3. Estado final de la ejecución.
            obtuvo_algo = bool(mediciones or clima or cams)
            estado = "ok" if not errores else ("parcial" if obtuvo_algo else "error")
            db.registrar_ejecucion(con, iniciado_en, datetime.now(timezone.utc), incluye_pronosticos,
                                   estado, filas, errores, avisos, origen)
    except Exception as e:
        # Sin base de datos no se puede registrar nada: la ejecución falla.
        log.error("No se pudo usar la base de datos: %s", ocultar(f"{type(e).__name__}: {e}"))
        return 1

    duracion = (datetime.now(timezone.utc) - iniciado_en).total_seconds()
    log.info("Fin: estado=%s | filas nuevas: mediciones=%d clima=%d cams=%d | %d errores, %d avisos | %.1f s",
             estado, filas["mediciones"], filas["clima"], filas["cams"], len(errores), len(avisos), duracion)
    if en_github and estado == "parcial":
        # Anotación visible en el resumen de la ejecución en GitHub.
        print(f"::warning::Ejecución parcial: {len(errores)} errores (ver tabla ejecuciones)")

    # Código de salida 1 solo si no se obtuvo nada: GitHub marca la ejecución en rojo.
    return 1 if estado == "error" else 0


if __name__ == "__main__":
    sys.exit(main())
