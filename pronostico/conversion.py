"""Conversión del AQI de PM2.5 que publica AQICN a µg/m³.

AQICN publica el índice AQI de la EPA calculado con la tabla de 2012 (justificado en
el notebook 05, parte 1). La inversa se obtiene por enumeración: para cada AQI entero,
el punto medio del intervalo de concentraciones que la ecuación de la EPA convierte en
ese AQI. La tabla está en modelo/conversion_aqi_pm25.csv (la misma del notebook 05).
"""

import numpy as np
import pandas as pd

from .config import CARPETA_MODELO, META

assert META["conversion_aqi"]["tabla"] == "EPA 2012"
_TABLA = pd.read_csv(CARPETA_MODELO / "conversion_aqi_pm25.csv", index_col="aqi")
_TABLA.index = _TABLA.index.astype(float)


def conc_desde_aqi(aqi) -> np.ndarray:
    """AQI entero → µg/m³. Los valores no enteros o fuera de 0–500 quedan como NaN."""
    return _TABLA.pm25.reindex(np.asarray(aqi, float)).to_numpy()
