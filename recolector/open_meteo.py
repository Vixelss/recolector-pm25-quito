"""Consulta de pronósticos en Open-Meteo: clima y PM2.5 de CAMS.

Se hace UNA solicitud para las 8 estaciones: Open-Meteo acepta varias
coordenadas separadas por comas y devuelve una lista en el mismo orden (D8).
"""

from datetime import datetime, timedelta, timezone

from . import config
from .red import ErrorFuente, obtener_json


def _consultar(url: str, variables: list[str], descripcion: str) -> list[dict]:
    params = {
        "latitude": ",".join(str(e.latitud) for e in config.ESTACIONES),
        "longitude": ",".join(str(e.longitud) for e in config.ESTACIONES),
        "hourly": ",".join(variables),
        "timezone": "America/Guayaquil",
        "forecast_hours": config.HORAS_HORIZONTE,
    }
    respuesta = obtener_json(url, params, descripcion)

    # Con una sola coordenada la API devuelve un objeto en vez de una lista.
    if isinstance(respuesta, dict):
        respuesta = [respuesta]
    if len(respuesta) != len(config.ESTACIONES):
        raise ErrorFuente(f"{descripcion}: se esperaban {len(config.ESTACIONES)} "
                          f"ubicaciones y llegaron {len(respuesta)}")
    return respuesta


def _horas_objetivo(ubicacion: dict) -> list[datetime]:
    """Convierte las horas locales sin zona ('2026-09-29T20:00') a timestamptz.

    La API no incluye la zona en cada hora, pero sí el desfase en
    utc_offset_seconds (-18000 = UTC-5), que se aplica aquí (hallazgo H11).
    """
    zona = timezone(timedelta(seconds=ubicacion["utc_offset_seconds"]))
    return [datetime.fromisoformat(t).replace(tzinfo=zona)
            for t in ubicacion["hourly"]["time"]]


def pronostico_clima(hora_emision: datetime, emitido_en: datetime) -> list[dict]:
    """Filas para pronostico_clima: una por estación y hora objetivo.

    hora_emision: hora de Ecuador en punto (identifica la emisión).
    emitido_en:   momento real de la consulta.
    """
    variables = list(config.VARIABLES_CLIMA)
    ubicaciones = _consultar(config.URL_CLIMA, variables, "Open-Meteo clima")

    filas = []
    for est, ub in zip(config.ESTACIONES, ubicaciones):
        horario = ub["hourly"]
        for i, hora in enumerate(_horas_objetivo(ub)):
            fila = {
                "estacion_id": est.id_aqicn,
                "hora_emision": hora_emision,
                "emitido_en": emitido_en,
                "hora_objetivo": hora,
                "lat_cuadricula": ub.get("latitude"),
                "lon_cuadricula": ub.get("longitude"),
                "elevacion_m": ub.get("elevation"),
            }
            # Si una variable no viene, se guarda NULL en lugar de fallar.
            for variable, columna in config.VARIABLES_CLIMA.items():
                serie = horario.get(variable)
                fila[columna] = serie[i] if serie else None
            filas.append(fila)
    return filas


def pronostico_cams(hora_emision: datetime, emitido_en: datetime) -> list[dict]:
    """Filas para pronostico_cams: una por estación y hora objetivo.

    pm2_5 puede venir como null al final del horizonte; se guarda como NULL.
    """
    ubicaciones = _consultar(config.URL_CAMS, ["pm2_5"], "Open-Meteo CAMS")

    filas = []
    for est, ub in zip(config.ESTACIONES, ubicaciones):
        valores = ub["hourly"]["pm2_5"]
        for hora, valor in zip(_horas_objetivo(ub), valores):
            filas.append({
                "estacion_id": est.id_aqicn,
                "hora_emision": hora_emision,
                "emitido_en": emitido_en,
                "hora_objetivo": hora,
                "pm2_5_ugm3": valor,
                "lat_cuadricula": ub.get("latitude"),
                "lon_cuadricula": ub.get("longitude"),
            })
    return filas
