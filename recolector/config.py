"""Configuración fija del recolector: estaciones, fuentes y parámetros.

Todo lo que no es secreto vive aquí, para que sea fácil de revisar y de
citar en la tesis. Los secretos (WAQI_TOKEN, DATABASE_URL) se leen de las
variables de entorno en main.py.
"""

from dataclasses import dataclass
from datetime import timedelta, timezone

# Ecuador continental: UTC-5 fijo, sin horario de verano.
ZONA_ECUADOR = timezone(timedelta(hours=-5))


@dataclass(frozen=True)
class Estacion:
    id_aqicn: int      # ID de la estación en AQICN (se consulta como @ID)
    nombre: str
    latitud: float     # coordenadas de la estación (se envían a Open-Meteo)
    longitud: float
    principal: bool


# Estaciones de la REMMAQ confirmadas en AQICN (ver CONTEXTO_RECOLECTOR.md §3).
# El orden importa: Open-Meteo devuelve sus resultados en este mismo orden.
ESTACIONES = [
    Estacion(6941,  "Belisario",   -0.184719, -78.495986, True),
    Estacion(6943,  "Carapungo",   -0.095472, -78.449809, True),
    Estacion(10686, "Tumbaco",     -0.214933, -78.403253, True),
    Estacion(6942,  "Cotocollao",  -0.107777, -78.497222, False),
    Estacion(6944,  "Centro",      -0.221393, -78.514005, False),
    Estacion(6945,  "Los Chillos", -0.297062, -78.455248, False),
    Estacion(10685, "Guamaní",     -0.333949, -78.553416, False),
    Estacion(10687, "El Camal",    -0.25,     -78.51,     False),  # sin datos desde 15/06/2026
]

# Horas de Ecuador en las que, además de medir, se guardan los pronósticos
# (decisión D2). Son también los momentos de emisión del modelo propio.
HORAS_PRONOSTICO = {0, 3, 6, 9, 12, 15, 18, 21}

# Si la medición de AQICN tiene más antigüedad que esto, se registra un aviso
# (caso típico: El Camal devuelve siempre el dato del 15/06/2026).
ANTIGUEDAD_MAXIMA_MEDICION = timedelta(hours=6)

# --- AQICN -----------------------------------------------------------------
URL_AQICN = "https://api.waqi.info/feed/@{id}/"
# Campos de data.iaqi que se guardan (escala AQI de la EPA, sin convertir).
CAMPOS_IAQI = ["pm25", "pm10", "no2", "co", "so2", "o3",
               "t", "h", "p", "w", "wd", "wg", "dew", "r"]

# --- Open-Meteo --------------------------------------------------------------
URL_CLIMA = "https://api.open-meteo.com/v1/forecast"
URL_CAMS = "https://air-quality-api.open-meteo.com/v1/air-quality"
HORAS_HORIZONTE = 48  # forecast_hours: desde la hora actual en adelante (D9)

# Variable de Open-Meteo -> columna de la tabla pronostico_clima (D10, D11).
VARIABLES_CLIMA = {
    "temperature_2m":       "temperatura_2m_c",
    "relative_humidity_2m": "humedad_relativa_2m_pct",
    "wind_speed_10m":       "viento_10m_kmh",
    "wind_direction_10m":   "direccion_viento_10m_grados",
    "precipitation":        "precipitacion_mm",
    "surface_pressure":     "presion_superficie_hpa",
    "shortwave_radiation":  "radiacion_onda_corta_wm2",
}

# --- Red -------------------------------------------------------------------
TIEMPO_ESPERA = (5, 10)   # segundos: (para conectar, para recibir la respuesta)
INTENTOS = 3              # intentos por solicitud
ESPERA_BASE = 1           # segundos; la espera entre intentos crece: 1 s, 2 s
