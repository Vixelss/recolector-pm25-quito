"""Carga los 24 modelos y produce el pronóstico de una emisión.

Cada archivo .ubj guarda los árboles de un XGBoost ya entrenado (uno por horizonte);
aquí solo se aplican, no se entrena nada.
"""

import numpy as np
import pandas as pd
import xgboost as xgb

from .config import (BANDA, CARPETA_MODELO, COLUMNAS, CORTES_IQCA, ESTACIONES, HORAS_SIN_DATOS, HORIZONTES,
                     META, NOMBRES_IQCA, RETRASO, UMBRAL_AVISO, UMBRAL_EPISODIO)
from .variables import variables_emision

_MODELOS: dict[int, xgb.Booster] = {}


def modelos() -> dict[int, xgb.Booster]:
    # Se usa el Booster de XGBoost (los árboles tal cual), sin la interfaz de scikit-learn,
    # que no hace falta para pronosticar. inplace_predict es lo mismo que usa XGBRegressor.predict.
    if not _MODELOS:
        for h in HORIZONTES:
            m = xgb.Booster()
            m.load_model(CARPETA_MODELO / META["archivos"][f"h{h}"])
            _MODELOS[h] = m
    return _MODELOS


def categoria(valor) -> np.ndarray:
    """Nombre de la categoría del IQCA (cortes en 25, 50, 150, 250 y 350 µg/m³)."""
    return np.array(NOMBRES_IQCA)[np.searchsorted(CORTES_IQCA, np.asarray(valor, float), side="left")]


def pronosticar(serie: pd.DataFrame, emision: pd.Timestamp) -> pd.DataFrame:
    """Pronóstico de los 24 horizontes para las 3 estaciones (72 filas).

    serie: PM2.5 limpio (µg/m³) con índice horario de Ecuador que termina en la emisión.
    """
    tablas = variables_emision(serie, emision)
    filas = []
    for h, t in tablas.items():
        valor = modelos()[h].inplace_predict(t[COLUMNAS])
        filas.append(pd.DataFrame({
            "estacion": t.estacion.to_numpy(), "horizonte": h, "hora_emision": emision,
            "hora_objetivo": emision + pd.Timedelta(hours=h), "pm25_ugm3": valor.astype(float),
            "variables_faltantes": t[COLUMNAS].isna().sum(axis=1).to_numpy(),
            "falta_ultimo": t["pm_E-2"].isna().to_numpy(),
        }))
    p = pd.concat(filas, ignore_index=True)
    p["banda_inferior"] = np.maximum(p.pm25_ugm3 + p.horizonte.astype(str).map(BANDA["p10"]), 0.0)
    p["banda_superior"] = p.pm25_ugm3 + p.horizonte.astype(str).map(BANDA["p90"])
    p["categoria"] = categoria(p.pm25_ugm3)
    p["cerca_del_limite"] = (p.pm25_ugm3 > UMBRAL_AVISO) & (p.pm25_ugm3 <= UMBRAL_EPISODIO)
    # RF8: datos incompletos si falta el dato más reciente que usa el modelo (E−2)
    p["datos_incompletos"] = p.falta_ultimo
    ultimo = {e: serie[e].last_valid_index() for e in ESTACIONES}
    p["ultimo_dato"] = p.estacion.map(ultimo)
    return p.drop(columns="falta_ultimo")


def sin_datos_recientes(ultimo_dato, emision: pd.Timestamp) -> bool:
    """RF8: la estación no tiene ninguna medición en las últimas HORAS_SIN_DATOS horas antes de la
    emisión. En operación, el dato más nuevo posible es el de E−2 (retraso de publicación)."""
    return ultimo_dato is None or pd.isna(ultimo_dato) or ultimo_dato < emision - pd.Timedelta(hours=HORAS_SIN_DATOS)


assert RETRASO == 2
