"""Configuración del servicio de pronóstico.

Todo lo que define al modelo (variables, estaciones, umbrales, feriados, limpieza)
se lee de modelo/metadatos.json, que generó el notebook 05 del análisis junto con
los 24 modelos. Aquí solo se agregan parámetros de operación.
"""

import json
from datetime import timedelta, timezone
from pathlib import Path

import pandas as pd

from recolector.config import ESTACIONES as ESTACIONES_RECOLECTOR

CARPETA_MODELO = Path(__file__).parent / "modelo"
META = json.loads((CARPETA_MODELO / "metadatos.json").read_text(encoding="utf-8"))
BANDA = json.loads((CARPETA_MODELO / "banda.json").read_text(encoding="utf-8"))

# --- Modelo (del notebook 05) -------------------------------------------------
ESTACIONES = META["estaciones"]                  # pronosticadas: BELISARIO, CARAPUNGO, TUMBACO
VECINAS = META["vecinas"]                        # sus PM2.5 son variables: las 3 + CENTRO y COTOCOLLAO
ID_AQICN = {int(k): v for k, v in META["id_aqicn"].items()}
ID_DE = {v: k for k, v in ID_AQICN.items()}
COLUMNAS = META["variables_en_orden"]
HORIZONTES = META["horizontes"]
RETRASO = META["retraso_publicacion_h"]          # las variables usan lo publicado hasta E−2
REZAGOS_PM = META["rezagos_pm"]
VENTANAS_PM = META["ventanas_pm"]
CAMBIO_TUMBACO = pd.Timestamp(META["cambio_tumbaco"])
UMBRAL_PEGADO = 6                                # regla L3: valor repetido 6 h o más
assert META["limpieza"]["L3"] == f"valor repetido {UMBRAL_PEGADO} h o más"
UMBRAL_EPISODIO = META["episodios"]["umbral_episodio"]   # 25 µg/m³
UMBRAL_AVISO = META["episodios"]["umbral_aviso"]         # 20 µg/m³ (aviso "cerca del límite")
CORTES_IQCA = META["categorias_iqca"]["cortes"]          # 25, 50, 150, 250, 350
NOMBRES_IQCA = META["categorias_iqca"]["nombres"]
VERSION_MODELO = META["fecha"]

# --- Operación -----------------------------------------------------------------
ZONA_ECUADOR = timezone(timedelta(hours=-5))     # las horas internas son de Ecuador, sin zona
DIAS_HISTORIA = 10                               # la variable más larga usa 168 h (7 días) + margen
HORAS_SIN_DATOS = 6                              # RF8: sin mediciones en 6 h → no se publica

NOMBRE = {e.nombre.upper().replace("Í", "I"): e.nombre for e in ESTACIONES_RECOLECTOR}
COORDENADAS = {e.id_aqicn: (e.latitud, e.longitud) for e in ESTACIONES_RECOLECTOR}
