"""Pruebas pequeñas de las piezas del servicio, con casos inventados (sin datos reales)."""

import numpy as np
import pandas as pd

from pronostico.conversion import conc_desde_aqi
from pronostico.limpieza import limpiar
from pronostico.modelo import categoria, pronosticar
from pronostico.config import VECINAS


def test_conversion_aqi():
    # Calculadora de AQICN: 10 µg/m³ → AQI 42 (tabla EPA 2012); la inversa vuelve a ~10
    assert abs(conc_desde_aqi([42])[0] - 10.0) < 0.25
    assert conc_desde_aqi([0])[0] < 0.25
    assert np.isnan(conc_desde_aqi([42.5])[0])          # AQI no entero: no se inventa un valor


def test_limpieza():
    s = pd.Series([5.0, 0, 0, 0, 7, 9, 9, 9, 9, 9, 9, 4, 2000])
    r = limpiar(s.copy())
    assert r.iloc[1:4].isna().all()                       # L2: 3 h en cero
    assert r.iloc[5:11].isna().all()                      # L3: 6 h con el mismo valor
    assert np.isnan(r.iloc[12])                           # L1: fuera de rango
    assert r.iloc[0] == 5 and r.iloc[4] == 7 and r.iloc[11] == 4


def test_categorias():
    assert list(categoria([10, 25, 25.1, 50, 51, 151])) == ["deseable", "deseable", "aceptable", "aceptable",
                                                           "precaución", "alerta"]


def test_pronostico_con_serie_sintetica():
    E = pd.Timestamp("2026-11-10 08:00")
    indice = pd.date_range(E - pd.Timedelta(days=10), E, freq="h")
    rng = np.random.default_rng(0)
    serie = pd.DataFrame({v: 12 + 4 * np.sin(np.arange(len(indice)) / 24 * 2 * np.pi) + rng.normal(0, 1, len(indice))
                          for v in VECINAS}, index=indice)
    serie.iloc[-2:] = np.nan                               # E−1 y E aún no publicados
    p = pronosticar(serie, E)
    assert len(p) == 72 and p.pm25_ugm3.between(0, 100).all()
    assert (p.banda_inferior <= p.pm25_ugm3).all() and (p.pm25_ugm3 <= p.banda_superior).all()
    assert not p.datos_incompletos.any()
    serie.iloc[-3, 0] = np.nan                             # falta E−2 de Belisario → datos incompletos
    p = pronosticar(serie, E)
    assert p[p.estacion == "BELISARIO"].datos_incompletos.all()
