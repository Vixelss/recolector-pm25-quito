"""Las 26 variables de la versión A, con la misma receta del entrenamiento (notebook 05).

Si estas funciones cambian, los modelos reciben entradas distintas a las que aprendieron
y el pronóstico se degrada sin dar error. Por eso tests/test_reproducibilidad.py compara
el resultado con las predicciones del notebook 05.
"""

import holidays
import numpy as np
import pandas as pd

from .config import CAMBIO_TUMBACO, COLUMNAS, ESTACIONES, HORIZONTES, RETRASO, REZAGOS_PM, VECINAS, VENTANAS_PM


def dias_feriados(anios) -> pd.DatetimeIndex:
    """Feriados nacionales de Ecuador en el día en que se descansan (si se trasladan, solo el
    día trasladado) más el 6 de diciembre (fundación de Quito)."""
    nacionales = holidays.Ecuador(years=anios)
    trasladados = {(d.year, n.replace(" (observado)", ""))
                   for d in nacionales for n in nacionales.get_list(d) if "(observado)" in n}
    dias = set()
    for d in nacionales:
        for n in nacionales.get_list(d):
            if "(observado)" not in n and (d.year, n) in trasladados and d.weekday() < 5:
                continue
            dias.add(pd.Timestamp(d))
    dias |= {pd.Timestamp(a, 12, 6) for a in anios}
    return pd.DatetimeIndex(sorted(dias))


def media(serie: pd.Series, ventana: int) -> pd.Series:
    return serie.rolling(ventana, min_periods=ventana // 2).mean()


def variables_estacion(e: str, h: int, pm25: pd.DataFrame, vecinas: pd.DataFrame, feriados) -> pd.DataFrame:
    """Variables de la estación e para el horizonte h, en cada hora de emisión del índice."""
    s = pm25[e]
    f = {f"pm_E-{k}": s.shift(k) for k in REZAGOS_PM}
    f["pm_ultimo"] = s.ffill(limit=2).shift(RETRASO)
    for w in VENTANAS_PM:
        f[f"pm_media_{w}h"] = media(s.shift(RETRASO), w)
    dia = 24 if h <= 24 - RETRASO else 48
    f["pm_t-24"] = s.shift(dia - h)
    f["pm_t-168"] = s.shift(168 - h)
    f = pd.DataFrame(f)
    objetivo = f.index + pd.Timedelta(hours=h)
    f["hora_t"] = objetivo.hour
    f["hora_t_sen"], f["hora_t_cos"] = np.sin(2 * np.pi * objetivo.hour / 24), np.cos(2 * np.pi * objetivo.hour / 24)
    f["dia_semana_t"] = objetivo.dayofweek
    f["mes_t_sen"], f["mes_t_cos"] = np.sin(2 * np.pi * (objetivo.month - 1) / 12), np.cos(2 * np.pi * (objetivo.month - 1) / 12)
    f["feriado_t"] = objetivo.normalize().isin(feriados).astype(int)
    for v in VECINAS:
        f[f"vecina_{v}_E-2"] = vecinas[v].shift(RETRASO)
    f["tumbaco_desde_2023_03"] = int(e == "TUMBACO") * (f.index >= CAMBIO_TUMBACO).astype(int)
    f["estacion"] = e
    f["estacion_cod"] = ESTACIONES.index(e)
    f.index.name = "emision"
    return f


def variables_emision(serie: pd.DataFrame, emision: pd.Timestamp) -> dict[int, pd.DataFrame]:
    """Para una emisión E: {h: tabla de 3 filas (una por estación) con las 26 variables}.

    serie: PM2.5 limpio en µg/m³, índice horario (hora de Ecuador) que termina en E,
    columnas = VECINAS. Solo debe contener lo que ya estaba publicado en E.
    """
    assert serie.index[-1] == emision and serie.index.freqstr in ("h", "H")
    feriados = dias_feriados(range(2018, emision.year + 2))
    tablas = {}
    for h in HORIZONTES:
        filas = [variables_estacion(e, h, serie[ESTACIONES], serie, feriados).loc[[emision]] for e in ESTACIONES]
        tablas[h] = pd.concat(filas)[["estacion"] + COLUMNAS]
    return tablas
