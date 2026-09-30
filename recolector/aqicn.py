"""Consulta de mediciones en AQICN (World Air Quality Index Project)."""

from datetime import datetime

from . import config
from .red import ErrorFuente, obtener_json


def a_numero(valor):
    """Convierte a float; devuelve None si viene vacío, '-' o como texto no numérico."""
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


def consultar_estacion(est: config.Estacion, token: str, consultado_en: datetime) -> dict:
    """Devuelve la última medición de una estación como una fila para mediciones_aqicn."""
    respuesta = obtener_json(
        config.URL_AQICN.format(id=est.id_aqicn),
        {"token": token},
        f"AQICN {est.nombre}",
    )
    if respuesta.get("status") != "ok":
        # Por ejemplo {"status": "error", "data": "Invalid key"}
        raise ErrorFuente(f"AQICN {est.nombre}: status={respuesta.get('status')} "
                          f"data={str(respuesta.get('data'))[:150]}")

    datos = respuesta["data"]

    # Hora de la medición: SIEMPRE time.iso (trae la zona -05:00).
    # time.v no se usa porque está desfasado 5 horas (hallazgo H2).
    iso = (datos.get("time") or {}).get("iso")
    if not iso:
        raise ErrorFuente(f"AQICN {est.nombre}: la respuesta no trae time.iso")

    # iaqi tiene la forma {"pm25": {"v": 75}, "t": {"v": 13.2}, ...};
    # cualquier campo puede faltar según la estación (hallazgo H3).
    iaqi = datos.get("iaqi") or {}
    valores = {campo: a_numero((iaqi.get(campo) or {}).get("v"))
               for campo in config.CAMPOS_IAQI}

    aqi = datos.get("aqi")
    return {
        "estacion_id": est.id_aqicn,
        "estacion": est.nombre,
        "medido_en": datetime.fromisoformat(iso),
        "aqi_general": None if aqi is None else str(aqi),
        "aqi_num": a_numero(aqi),
        "contaminante_dominante": datos.get("dominentpol"),
        **valores,
        "consultado_en": consultado_en,
        "respuesta_cruda": respuesta,
    }
