"""Solicitudes HTTP con tiempo de espera, reintentos y ocultamiento de secretos."""

import logging
import time

import requests

from . import config

log = logging.getLogger(__name__)

# Secretos que nunca deben aparecer en un mensaje (se registran en main.py).
_secretos: list[str] = []


def registrar_secreto(valor: str) -> None:
    if valor:
        _secretos.append(valor)


def ocultar(texto: str) -> str:
    """Reemplaza cualquier secreto por <oculto>.

    Necesario porque requests incluye la URL completa (con el token) en sus
    mensajes de error (hallazgo H9).
    """
    for s in _secretos:
        texto = texto.replace(s, "<oculto>")
    return texto


class ErrorFuente(Exception):
    """Error al consultar una fuente, con el mensaje ya limpio de secretos."""


def obtener_json(url: str, params: dict, descripcion: str):
    """Hace GET y devuelve el JSON; reintenta ante fallos temporales.

    Se reintenta ante errores de red, tiempo agotado, HTTP 429 (demasiadas
    solicitudes) y HTTP 5xx. Un error 4xx distinto de 429 indica una
    solicitud mal formada: reintentar no ayuda, así que falla de inmediato.
    """
    ultimo_error = ""
    for intento in range(1, config.INTENTOS + 1):
        try:
            r = requests.get(url, params=params, timeout=config.TIEMPO_ESPERA)
            if r.status_code == 429 or r.status_code >= 500:
                ultimo_error = f"HTTP {r.status_code}"
            elif r.status_code >= 400:
                raise ErrorFuente(ocultar(f"{descripcion}: HTTP {r.status_code} {r.text[:200]}"))
            else:
                return r.json()
        except requests.RequestException as e:
            ultimo_error = f"{type(e).__name__}: {e}"
        except ValueError as e:  # la respuesta no era JSON válido
            ultimo_error = f"respuesta no es JSON: {e}"

        ultimo_error = ocultar(ultimo_error)
        if intento < config.INTENTOS:
            espera = config.ESPERA_BASE * 2 ** (intento - 1)
            log.warning("%s: intento %d falló (%s); reintento en %d s",
                        descripcion, intento, ultimo_error[:150], espera)
            time.sleep(espera)

    raise ErrorFuente(f"{descripcion}: falló tras {config.INTENTOS} intentos ({ultimo_error[:300]})")
