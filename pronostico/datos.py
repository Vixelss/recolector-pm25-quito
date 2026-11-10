"""Lectura de Neon y armado de la serie horaria de PM2.5 que usa el modelo.

Las tablas guardan las horas en UTC; dentro del servicio se trabaja con la hora de
Ecuador sin zona (UTC−5), igual que en el entrenamiento. La etiqueta t cubre de t a t+1.
"""

import numpy as np
import pandas as pd

from .config import DIAS_HISTORIA, ID_AQICN, ID_DE, VECINAS
from .conversion import conc_desde_aqi
from .limpieza import limpiar


def a_local(columna) -> pd.Series:
    """Fechas con zona (o texto ISO con zona) → hora de Ecuador sin zona."""
    return pd.to_datetime(columna, utc=True).dt.tz_convert(None) - pd.Timedelta(hours=5)


def a_utc(hora_local) -> pd.Timestamp:
    """Hora de Ecuador sin zona → instante con zona UTC (para guardar en Neon)."""
    return (pd.Timestamp(hora_local) + pd.Timedelta(hours=5)).tz_localize("UTC")


def serie_pm25(mediciones: pd.DataFrame, emision: pd.Timestamp, dias: int = DIAS_HISTORIA) -> pd.DataFrame:
    """Serie horaria de PM2.5 en µg/m³, limpia, de las 5 estaciones que usa el modelo.

    mediciones: filas de mediciones_aqicn con estacion_id, medido_en (UTC), consultado_en (UTC)
    y pm25 (AQI). Solo se usa lo que el recolector ya había visto antes de terminar la hora de
    emisión (consultado_en < E + 1 h) y las horas hasta E. El índice va de E − dias a E.
    """
    m = mediciones.assign(t=a_local(mediciones.medido_en), visto=a_local(mediciones.consultado_en),
                          estacion=mediciones.estacion_id.map(ID_AQICN))
    m = m[m.estacion.isin(VECINAS) & (m.visto < emision + pd.Timedelta(hours=1)) & (m.t <= emision)]
    indice = pd.date_range(emision - pd.Timedelta(days=dias), emision, freq="h")
    aqi = m.pivot(index="t", columns="estacion", values="pm25").reindex(index=indice, columns=VECINAS)
    serie = aqi.apply(lambda s: pd.Series(conc_desde_aqi(s), index=s.index))
    for e in VECINAS:
        serie[e] = limpiar(serie[e].copy())
    serie.index.freq = "h"
    return serie


# --- Neon -----------------------------------------------------------------------

def leer_mediciones(conexion, emision: pd.Timestamp, dias: int = DIAS_HISTORIA) -> pd.DataFrame:
    desde = a_utc(emision - pd.Timedelta(days=dias + 1))
    with conexion.cursor() as cur:
        cur.execute("""
            SELECT estacion_id, medido_en, consultado_en, pm25
            FROM mediciones_aqicn
            WHERE estacion_id = ANY(%s) AND medido_en >= %s
        """, ([ID_DE[e] for e in VECINAS], desde.to_pydatetime()))
        filas = cur.fetchall()
    return pd.DataFrame(filas, columns=["estacion_id", "medido_en", "consultado_en", "pm25"]).astype({"pm25": float})


def leer_pronosticos(conexion, desde: pd.Timestamp) -> pd.DataFrame:
    """Pronósticos guardados del modelo con hora_objetivo desde la fecha dada (hora de Ecuador)."""
    with conexion.cursor() as cur:
        cur.execute("""
            SELECT estacion_id, hora_emision, horizonte, hora_objetivo, pm25_ugm3, banda_inferior, banda_superior,
                   categoria, cerca_del_limite, datos_incompletos, ultimo_dato, version_modelo
            FROM pronostico_modelo WHERE hora_objetivo >= %s
        """, (a_utc(desde).to_pydatetime(),))
        columnas = [d.name for d in cur.description]
        p = pd.DataFrame(cur.fetchall(), columns=columnas)
    p["estacion"] = p.estacion_id.map(ID_AQICN)
    for c in ("hora_emision", "hora_objetivo", "ultimo_dato"):
        p[c] = a_local(p[c])
    return p


def leer_cams(conexion, desde: pd.Timestamp) -> pd.DataFrame:
    """Pronóstico de CAMS guardado por el recolector (emisiones cada 3 h) para las estaciones pronosticadas."""
    with conexion.cursor() as cur:
        cur.execute("""
            SELECT estacion_id, hora_emision, hora_objetivo, pm2_5_ugm3
            FROM pronostico_cams WHERE hora_emision >= %s AND estacion_id = ANY(%s)
        """, (a_utc(desde).to_pydatetime(), [ID_DE[e] for e in ("BELISARIO", "CARAPUNGO", "TUMBACO")]))
        c = pd.DataFrame(cur.fetchall(), columns=["estacion_id", "hora_emision", "hora_objetivo", "pm2_5_ugm3"])
    c["estacion"] = c.estacion_id.map(ID_AQICN)
    c["hora_emision"], c["hora_objetivo"] = a_local(c.hora_emision), a_local(c.hora_objetivo)
    return c.astype({"pm2_5_ugm3": float})
