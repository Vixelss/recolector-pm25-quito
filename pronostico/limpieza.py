"""Reglas de limpieza del PM2.5, las mismas del entrenamiento (notebook 01).

Solo convierten valores en faltantes; no rellenan nada.
- L1: fuera de 0–1000 µg/m³.
- L2: PM2.5 en 0 durante 3 h o más seguidas.
- L3: el mismo valor distinto de 0 durante 6 h o más seguidas (sensor pegado).
"""

import numpy as np
import pandas as pd

from .config import UMBRAL_PEGADO


def rachas(mascara: pd.Series):
    """Inicio y largo de cada racha de valores True."""
    m = np.r_[False, mascara.to_numpy(), False].astype(int)
    cambios = np.diff(m)
    ini, fin = np.where(cambios == 1)[0], np.where(cambios == -1)[0]
    return ini, fin - ini


def limpiar(s: pd.Series) -> pd.Series:
    s = s.where((s >= 0) & (s <= 1000))                                   # L1
    ini, largo = rachas(s.eq(0))
    for i, l in zip(ini, largo):                                          # L2
        if l >= 3:
            s.iloc[i:i + l] = np.nan
    grupo = s.ne(s.shift()).cumsum()                                      # L3
    return s.mask(s.notna() & (s != 0) & (s.groupby(grupo).transform("size") >= UMBRAL_PEGADO))
